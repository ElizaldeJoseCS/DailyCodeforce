package handlers

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

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
		case "link":
			handleLink(s, i, db)
		case "verify":
			handleVerify(s, i, db)
		case "problem":
			handleProblem(s, i, db)
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
		{
			Name:        "link",
			Description: "Link your Discord to your DailyCodeforce account",
		},
		{
			Name:        "verify",
			Description: "Verify your Codeforces handle ownership",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionSubCommand,
					Name:        "start",
					Description: "Start verification with your Codeforces handle",
					Options: []*discordgo.ApplicationCommandOption{
						{
							Type:        discordgo.ApplicationCommandOptionString,
							Name:        "handle",
							Description: "Your Codeforces handle",
							Required:    true,
						},
					},
				},
				{
					Type:        discordgo.ApplicationCommandOptionSubCommand,
					Name:        "confirm",
					Description: "Confirm you've set the verification token on your CF profile",
				},
			},
		},
		{
			Name:        "problem",
			Description: "Look up any Codeforces problem by URL or ID",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "query",
					Description: "CF URL (e.g. codeforces.com/problemset/problem/1579/E1) or ID (e.g. 1579E1)",
					Required:    true,
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

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func handleLink(s *discordgo.Session, i *discordgo.InteractionCreate, db *sql.DB) {
	discordID := i.Member.User.ID

	var existingUsername string
	err := db.QueryRow(`SELECT username FROM users WHERE "discordId" = $1`, discordID).Scan(&existingUsername)
	if err == nil {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: fmt.Sprintf("✅ Your Discord is already linked to **%s**!", existingUsername),
			},
		})
		return
	}

	code := generateCode(6)

	db.Exec(`DELETE FROM discord_link_codes WHERE "discordId" = $1`, discordID)

	_, err = db.Exec(`
		INSERT INTO discord_link_codes (code, "discordId", "expiresAt")
		VALUES ($1, $2, $3)
	`, code, discordID, time.Now().Add(10*time.Minute))
	if err != nil {
		log.Printf("Error inserting link code: %v", err)
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ Failed to generate link code. Please try again.",
			},
		})
		return
	}

	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Content: fmt.Sprintf(
				"🔗 **Link your account**\n\nGo to **%s/auth/link** and enter this code:\n\n# `%s`\n\n⏰ Code expires in 10 minutes.",
				getEnv("SITE_URL", "https://codeforces-practice.com"),
				strings.ToUpper(code),
			),
		},
	})
}

func generateCode(n int) string {
	const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, n)
	rand.Read(b)
	for i := range b {
		b[i] = letters[b[i]%byte(len(letters))]
	}
	return string(b)
}
