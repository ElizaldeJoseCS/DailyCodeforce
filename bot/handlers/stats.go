package handlers

import (
	"database/sql"
	"fmt"

	"github.com/bwmarrin/discordgo"
)

func handleStats(s *discordgo.Session, i *discordgo.InteractionCreate, db *sql.DB) {
	userID := i.Member.User.ID

	var username string
	err := db.QueryRow(`SELECT username FROM users WHERE "discordId" = $1`, userID).Scan(&username)
	if err == sql.ErrNoRows {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "⚠️ You haven't linked your account yet. Visit the website to sign in!",
			},
		})
		return
	}

	var totalSolved int
	db.QueryRow(`
		SELECT COUNT(*) FROM user_progress up
		JOIN users u ON u.id = up."userId"
		WHERE u."discordId" = $1
	`, userID).Scan(&totalSolved)

	tierCounts := map[string]int{}
	rows, err := db.Query(`
		SELECT dp.tier, COUNT(*) as cnt
		FROM user_progress up
		JOIN users u ON u.id = up."userId"
		JOIN daily_problems dp ON dp.id = up."dailyProblemId"
		WHERE u."discordId" = $1
		GROUP BY dp.tier
	`, userID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var tier string
			var cnt int
			if rows.Scan(&tier, &cnt) == nil {
				tierCounts[tier] = cnt
			}
		}
	}

	description := fmt.Sprintf("**%s** has solved **%d** problems\n\n", username, totalSolved)
	description += "**By Tier:**\n"
	for _, tier := range []string{"beginner", "intermediate", "advanced", "expert"} {
		emoji := tierEmojiMap()[tier]
		count := tierCounts[tier]
		description += fmt.Sprintf("%s %s: **%d**\n", emoji, tier, count)
	}

	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Embeds: []*discordgo.MessageEmbed{
				{
					Title:       "📊 Your Stats",
					Description: description,
					Color:       0x06b6d4,
				},
			},
		},
	})
}

func handleLeaderboard(s *discordgo.Session, i *discordgo.InteractionCreate, db *sql.DB) {
	rows, err := db.Query(`
		SELECT u.username, u."avatarUrl", COUNT(up.id) as solved
		FROM user_progress up
		JOIN users u ON u.id = up."userId"
		GROUP BY u.id, u.username, u."avatarUrl"
		ORDER BY solved DESC
		LIMIT 10
	`)
	if err != nil {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ Failed to fetch leaderboard",
			},
		})
		return
	}
	defer rows.Close()

	description := ""
	rank := 0
	medals := []string{"🥇", "🥈", "🥉"}

	for rows.Next() {
		var username, avatarURL sql.NullString
		var solved int
		if err := rows.Scan(&username, &avatarURL, &solved); err != nil {
			continue
		}

		rank++
		prefix := fmt.Sprintf("**#%d**", rank)
		if rank <= 3 {
			prefix = medals[rank-1]
		}

		name := "Unknown"
		if username.Valid {
			name = username.String
		}

		description += fmt.Sprintf("%s %s — **%d** solved\n", prefix, name, solved)
	}

	if description == "" {
		description = "No data yet. Solve some problems first!"
	}

	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Embeds: []*discordgo.MessageEmbed{
				{
					Title:       "🏆 Leaderboard",
					Description: description,
					Color:       0xfbbf24,
				},
			},
		},
	})
}
