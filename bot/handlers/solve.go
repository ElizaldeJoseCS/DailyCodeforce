package handlers

import (
	"database/sql"
	"fmt"

	"github.com/bwmarrin/discordgo"
)

func handleSolve(s *discordgo.Session, i *discordgo.InteractionCreate, db *sql.DB) {
	userID := i.Member.User.ID
	tier := i.ApplicationCommandData().Options[0].StringValue()

	var userDBID string
	err := db.QueryRow(`SELECT id FROM users WHERE "discordId" = $1`, userID).Scan(&userDBID)
	if err == sql.ErrNoRows {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "⚠️ You haven't linked your account yet. Visit the website to sign in!",
			},
		})
		return
	}

	var dailyProblemID string
	err = db.QueryRow(`
		SELECT id FROM daily_problems
		WHERE tier = $1 AND date = CURRENT_DATE
	`, tier).Scan(&dailyProblemID)
	if err == sql.ErrNoRows {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: fmt.Sprintf("📭 No %s problem assigned today.", tier),
			},
		})
		return
	}

	var existing string
	err = db.QueryRow(`
		SELECT id FROM user_progress
		WHERE "userId" = $1 AND "dailyProblemId" = $2
	`, userDBID, dailyProblemID).Scan(&existing)
	if err == nil {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "✅ You already solved this one!",
			},
		})
		return
	}

	_, err = db.Exec(`
		INSERT INTO user_progress (id, "userId", "dailyProblemId", "solvedAt")
		VALUES (gen_random_uuid()::text, $1, $2, NOW())
	`, userDBID, dailyProblemID)
	if err != nil {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ Failed to record progress",
			},
		})
		return
	}

	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Content: fmt.Sprintf("🎉 Nice work! Marked today's **%s** problem as solved!", tier),
		},
	})
}
