package handlers

import (
	"database/sql"
	"fmt"

	"github.com/bwmarrin/discordgo"
)

func handleDaily(s *discordgo.Session, i *discordgo.InteractionCreate, db *sql.DB) {
	tierFilter := ""
	if len(i.ApplicationCommandData().Options) > 0 {
		tierFilter = i.ApplicationCommandData().Options[0].StringValue()
	}

	tierRange := map[string]string{
		"beginner":     "800–1200",
		"intermediate": "1200–1600",
		"advanced":     "1600–2000",
		"expert":       "2000+",
	}

	query := `
		SELECT dp.tier, p.name, p.rating, p.url, p.tags
		FROM daily_problems dp
		JOIN problems p ON p.id = dp."problemId"
		WHERE dp.date = CURRENT_DATE
	`
	args := []interface{}{}

	if tierFilter != "" {
		query += " AND dp.tier = $1"
		args = append(args, tierFilter)
	}

	query += " ORDER BY dp.tier"

	rows, err := db.Query(query, args...)
	if err != nil {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ Failed to fetch today's problems",
			},
		})
		return
	}
	defer rows.Close()

	embeds := []*discordgo.MessageEmbed{}

	for rows.Next() {
		var tier, name, url string
		var rating int
		var tags string

		if err := rows.Scan(&tier, &name, &rating, &url, &tags); err != nil {
			continue
		}

		emoji := tierEmojiMap()[tier]
		label := fmt.Sprintf("%s (%s)", tier[0:1]+tier[1:], tierRange[tier])

		color := tierColorInt(tier)

		embeds = append(embeds, &discordgo.MessageEmbed{
			Title: fmt.Sprintf("%s %s", emoji, name),
			URL:   url,
			Description: fmt.Sprintf(
				"**Tier:** %s\n**Rating:** %d\n**Tags:** %s",
				label, rating, tags,
			),
			Color: color,
		})
	}

	if len(embeds) == 0 {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "📭 No problems assigned for today yet.",
			},
		})
		return
	}

	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Embeds: embeds,
		},
	})
}
