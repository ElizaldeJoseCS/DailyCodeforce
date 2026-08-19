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
	log.Printf("Logged in as %s#%s", m.User.Username, m.User.Discriminator)
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
		JOIN problems p ON p.id = dp.problem_id
		WHERE dp.date = CURRENT_DATE
		ORDER BY dp.tier
	`)
	if err != nil {
		return fmt.Errorf("query daily problems: %w", err)
	}
	defer rows.Close()

	embeds := []*discordgo.MessageEmbed{}
	for rows.Next() {
		var tier, name, url, tags string
		var rating int
		if err := rows.Scan(&tier, &name, &rating, &url, &tags); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		emoji := tierEmoji[tier]
		label := tierLabel[tier]

		embeds = append(embeds, &discordgo.MessageEmbed{
			Title:       fmt.Sprintf("%s %s — %s", emoji, name, label),
			URL:         url,
			Description: fmt.Sprintf("**Rating:** %d\n**Tags:** %s", rating, tags),
			Color:       tierColorInt(tier),
		})
	}

	if len(embeds) == 0 {
		return nil
	}

	_, err = s.ChannelMessageSendEmbed(channelID, &discordgo.MessageEmbed{
		Title:       "📋 Today's DailyCodeforce Problems",
		Description: "Here are today's challenges across all difficulty levels. Good luck!",
		Color:       0x06b6d4,
		Fields:      nil,
	})

	for _, e := range embeds {
		s.ChannelMessageSendEmbed(channelID, e)
	}

	return err
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
