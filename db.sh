#!/bin/bash
# DailyCodeforce DB Management Tool
# Usage: ./db.sh [command] [args]

DB_CONTAINER="dailycodeforce-postgres-1"
DB_USER="dailycodeforce"
DB_NAME="dailycodeforce"

psql_cmd() {
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

psql_interactive() {
  docker exec -it "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
}

case "$1" in
  # ─── VIEW ───────────────────────────────────────────
  tables)
    echo "=== Tables ==="
    psql_cmd "\dt"
    ;;
  schema)
    psql_cmd "\d ${2:-users}"
    ;;
  users)
    psql_cmd "SELECT id, username, \"cfHandle\", \"totalSolved\", \"currentStreak\", \"longestStreak\", role FROM users ORDER BY username;"
    ;;
  user)
    if [ -z "$2" ]; then echo "Usage: ./db.sh user <username>"; exit 1; fi
    psql_cmd "SELECT * FROM users WHERE username = '$2';"
    ;;
  problems)
    psql_cmd "SELECT id, name, rating, url FROM problems ORDER BY rating;"
    ;;
  daily)
    psql_cmd "SELECT dp.date, dp.tier, p.name, p.rating FROM daily_problems dp JOIN problems p ON p.id = dp.\"problemId\" ORDER BY dp.date DESC, dp.tier LIMIT 20;"
    ;;
  solves)
    psql_cmd "SELECT u.username, dp.date, dp.tier, p.name FROM user_progress up JOIN users u ON u.id = up.\"userId\" JOIN daily_problems dp ON dp.id = up.\"dailyProblemId\" JOIN problems p ON p.id = dp.\"problemId\" ORDER BY up.\"solvedAt\" DESC LIMIT 20;"
    ;;
  solves-user)
    if [ -z "$2" ]; then echo "Usage: ./db.sh solves-user <username>"; exit 1; fi
    psql_cmd "SELECT dp.date, dp.tier, p.name, p.rating, up.verified, up.\"solvedAt\" FROM user_progress up JOIN users u ON u.id = up.\"userId\" JOIN daily_problems dp ON dp.id = up.\"dailyProblemId\" JOIN problems p ON p.id = dp.\"problemId\" WHERE u.username = '$2' ORDER BY up.\"solvedAt\" DESC;"
    ;;
  reports)
    psql_cmd "SELECT er.id, u.username, dp.date, p.name, er.message, er.\"createdAt\" FROM editorial_reports er LEFT JOIN users u ON u.id = er.\"userId\" LEFT JOIN daily_problems dp ON dp.id = er.\"dailyProblemId\" LEFT JOIN problems p ON p.id = dp.\"problemId\" ORDER BY er.\"createdAt\" DESC;"
    ;;
  counts)
    echo "=== Row Counts ==="
    psql_cmd "SELECT 'users' as table_name, COUNT(*) FROM users UNION ALL SELECT 'problems', COUNT(*) FROM problems UNION ALL SELECT 'daily_problems', COUNT(*) FROM daily_problems UNION ALL SELECT 'user_progress', COUNT(*) FROM user_progress UNION ALL SELECT 'editorial_reports', COUNT(*) FROM editorial_reports UNION ALL SELECT 'cf_verifications', COUNT(*) FROM cf_verifications UNION ALL SELECT 'discord_link_codes', COUNT(*) FROM discord_link_codes;"
    ;;
  streaks)
    psql_cmd "SELECT username, \"currentStreak\", \"longestStreak\", \"totalSolved\" FROM users WHERE \"currentStreak\" > 0 ORDER BY \"currentStreak\" DESC;"
    ;;

  # ─── EDIT ───────────────────────────────────────────
  delete-user)
    if [ -z "$2" ]; then echo "Usage: ./db.sh delete-user <username>"; exit 1; fi
    echo "Deleting user '$2' and all their data..."
    psql_cmd "
      DELETE FROM user_progress WHERE \"userId\" IN (SELECT id FROM users WHERE username = '$2');
      DELETE FROM editorial_reports WHERE \"userId\" IN (SELECT id FROM users WHERE username = '$2');
      DELETE FROM cf_verifications WHERE \"userId\" IN (SELECT id FROM users WHERE username = '$2');
      DELETE FROM users WHERE username = '$2';
    "
    echo "Done."
    ;;
  reset-streak)
    if [ -z "$2" ]; then echo "Usage: ./db.sh reset-streak <username>"; exit 1; fi
    psql_cmd "UPDATE users SET \"currentStreak\" = 0 WHERE username = '$2';"
    echo "Streak reset for $2."
    ;;
  set-role)
    if [ -z "$2" ] || [ -z "$3" ]; then echo "Usage: ./db.sh set-role <username> <role>"; exit 1; fi
    psql_cmd "UPDATE users SET role = '$3' WHERE username = '$2';"
    echo "Role set to '$3' for $2."
    ;;
  unverify)
    if [ -z "$2" ]; then echo "Usage: ./db.sh unverify <username>"; exit 1; fi
    psql_cmd "UPDATE users SET \"cfHandle\" = NULL WHERE username = '$2';"
    echo "CF handle removed for $2."
    ;;
  clear-editorials)
    psql_cmd "UPDATE daily_problems SET editorial = NULL;"
    echo "All editorials cleared."
    ;;
  delete-daily)
    if [ -z "$2" ]; then echo "Usage: ./db.sh delete-daily <YYYY-MM-DD>"; exit 1; fi
    psql_cmd "DELETE FROM daily_problems WHERE date = '$2';"
    echo "Daily problems for $2 deleted."
    ;;
  exec)
    shift
    psql_cmd "$*"
    ;;
  shell)
    psql_interactive
    ;;

  *)
    echo "DailyCodeforce DB Manager"
    echo ""
    echo "VIEW commands:"
    echo "  tables          List all tables"
    echo "  schema [table]  Show table schema (default: users)"
    echo "  users           List all users with stats"
    echo "  user <name>     Show full user record"
    echo "  problems        List all problems"
    echo "  daily           Show recent daily assignments"
    echo "  solves          Show recent solves"
    echo "  solves-user     Show solves for a user"
    echo "  reports         Show editorial reports"
    echo "  counts          Row counts for all tables"
    echo "  streaks         Show users with active streaks"
    echo ""
    echo "EDIT commands:"
    echo "  delete-user <name>       Delete a user and all their data"
    echo "  reset-streak <name>      Reset a user's current streak to 0"
    echo "  set-role <name> <role>   Set user role (user/mod/admin)"
    echo "  unverify <name>          Remove a user's CF handle"
    echo "  clear-editorials         Clear all editorials (regenerate)"
    echo "  delete-daily <date>      Delete daily problems for a date"
    echo "  exec <sql>               Run arbitrary SQL"
    echo "  shell                    Open interactive psql"
    ;;
esac
