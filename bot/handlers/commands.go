package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/bwmarrin/discordgo"
)

var registeredCommands []*discordgo.ApplicationCommand

func OnReady(s *discordgo.Session, m *discordgo.Ready) {
	log.Printf("Logged in as %s", m.User.Username)
}

func OnInteractionCreate(db *sql.DB) func(s *discordgo.Session, i *discordgo.InteractionCreate) {
	return func(s *discordgo.Session, i *discordgo.InteractionCreate) {
		if i.Type != discordgo.InteractionApplicationCommand {
			return
		}

		switch i.ApplicationCommandData().Name {
		case "daily":
			handleDaily(s, i, db)
		case "stats":
			handleStats(s, i, db)
		case "leaderboard":
			handleLeaderboard(s, i, db)
		case "solve":
			handleSolve(s, i, db)
		}
	}
}

func RegisterCommands(s *discordgo.Session) {
	guildID := getEnv("GUILD_ID", "")

	commands := []*discordgo.ApplicationCommand{
		{
			Name:        "daily",
			Description: "Show today's Codeforces problems",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "tier",
					Description: "Filter by difficulty tier",
					Required:    false,
					Choices: []*discordgo.ApplicationCommandOptionChoice{
						{Name: "Beginner", Value: "beginner"},
						{Name: "Intermediate", Value: "intermediate"},
						{Name: "Advanced", Value: "advanced"},
						{Name: "Expert", Value: "expert"},
					},
				},
			},
		},
		{
			Name:        "stats",
			Description: "View your solving statistics",
		},
		{
			Name:        "leaderboard",
			Description: "View the top solvers",
		},
		{
			Name:        "solve",
			Description: "Mark a problem as solved",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "tier",
					Description: "Which tier problem to mark as solved",
					Required:    true,
					Choices: []*discordgo.ApplicationCommandOptionChoice{
						{Name: "Beginner", Value: "beginner"},
						{Name: "Intermediate", Value: "intermediate"},
						{Name: "Advanced", Value: "advanced"},
						{Name: "Expert", Value: "expert"},
					},
				},
			},
		},
	}

	for _, cmd := range commands {
		c, err := s.ApplicationCommandCreate(s.State.User.ID, guildID, cmd)
		if err != nil {
			log.Printf("Failed to create command %s: %v", cmd.Name, err)
			continue
		}
		registeredCommands = append(registeredCommands, c)
		log.Printf("Registered command: /%s", cmd.Name)
	}
}

func UnregisterCommands(s *discordgo.Session) {
	guildID := getEnv("GUILD_ID", "")
	for _, cmd := range registeredCommands {
		err := s.ApplicationCommandDelete(s.State.User.ID, guildID, cmd.ID)
		if err != nil {
			log.Printf("Failed to delete command %s: %v", cmd.Name, err)
		}
	}
}

func SendDailyNotification(s *discordgo.Session, db *sql.DB, channelID string) error {
	tierEmoji := map[string]string{
		"beginner":     "🟢",
		"intermediate": "🔵",
		"advanced":     "🟠",
		"expert":       "🔴",
	}
	tierLabel := map[string]string{
		"beginner":     "Beginner (800–1200)",
		"intermediate": "Intermediate (1200–1600)",
		"advanced":     "Advanced (1600–2000)",
		"expert":       "Expert (2000+)",
	}

	rows, err := db.Query(`
		SELECT dp.tier, p.name, p.rating, p.url, p.tags
		FROM daily_problems dp
		JOIN problems p ON p.id = dp."problemId"
		WHERE dp.date = CURRENT_DATE
		ORDER BY dp.tier
	`)
	if err != nil {
		return fmt.Errorf("query daily problems: %w", err)
	}
	defer rows.Close()

	type problem struct {
		tier, name, url, tags string
		rating                int
	}

	var problems []problem

	for rows.Next() {
		var p problem
		if err := rows.Scan(&p.tier, &p.name, &p.rating, &p.url, &p.tags); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}
		problems = append(problems, p)
	}

	if len(problems) == 0 {
		return nil
	}

	description := ""
	for _, p := range problems {
		emoji := tierEmoji[p.tier]
		label := tierLabel[p.tier]
		description += fmt.Sprintf("%s **%s** — %s\nRating: %d | [Solve](%s)\n\n", emoji, p.name, label, p.rating, p.url)
	}

	content := fmt.Sprintf("📋 **Today's DailyCodeforce Problems**\n\n%sGood luck!", description)

	thread, err := s.ThreadStart(channelID, "📋 Daily Problems", discordgo.ThreadPublic, 10080)
	if err != nil {
		log.Printf("Failed to create forum thread: %v", err)
		return err
	}

	_, err = s.ChannelMessageSend(thread.ID, content)
	if err != nil {
		log.Printf("Failed to send message to thread: %v", err)
		return err
	}

	return nil
}

func tierColorInt(tier string) int {
	switch tier {
	case "beginner":
		return 0x10b981
	case "intermediate":
		return 0x3b82f6
	case "advanced":
		return 0xf97316
	case "expert":
		return 0xef4444
	default:
		return 0x6b7280
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
