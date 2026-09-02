package handlers

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/bwmarrin/discordgo"
)

func handleDaily(s *discordgo.Session, i *discordgo.InteractionCreate, db *sql.DB) {
	tierFilter := ""
	if len(i.ApplicationCommandData().Options) > 0 {
		tierFilter = i.ApplicationCommandData().Options[0].StringValue()
	}

	query := `
		SELECT dp.id, dp.tier, p.name, p.rating, p.url, p.tags
		FROM daily_problems dp
		JOIN problems p ON p.id = dp."problemId"
		WHERE dp.date = CURRENT_DATE
	`
	args := []interface{}{}

	if tierFilter != "" {
		query += " AND dp.tier = $1"
		args = append(args, tierFilter)
	}

	query += " ORDER BY CASE dp.tier WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'advanced' THEN 3 WHEN 'expert' THEN 4 END"

	rows, err := db.Query(query, args...)
	if err != nil {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "Failed to fetch today's problems",
			},
		})
		return
	}
	defer rows.Close()

	type dailyProblem struct {
		id, tier, name, url, tags string
		rating                    int
	}

	var problems []dailyProblem
	for rows.Next() {
		var p dailyProblem
		if err := rows.Scan(&p.id, &p.tier, &p.name, &p.rating, &p.url, &p.tags); err != nil {
			continue
		}
		problems = append(problems, p)
	}

	if len(problems) == 0 {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "No problems assigned for today yet.",
			},
		})
		return
	}

	embeds := []*discordgo.MessageEmbed{}
	for _, p := range problems {
		emoji := tierEmojiMap()[p.tier]
		color := tierColorInt(p.tier)
		siteURL := fmt.Sprintf("%s/problem/%s", getEnv("SITE_URL", "https://codeforces-practice.com"), p.id)

		desc := fmt.Sprintf("%s %s\n\n**Tags:** %s",
			emoji, p.name, CleanPgtags(p.tags))

		embeds = append(embeds, &discordgo.MessageEmbed{
			Title:       fmt.Sprintf("%s — %s (Rating: %d)", p.tier[0:1]+p.tier[1:], p.name, p.rating),
			URL:         siteURL,
			Description: desc,
			Color:       color,
		})
	}

	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Embeds: embeds,
		},
	})
}

func SendDailyNotification(s *discordgo.Session, db *sql.DB, channelID string) error {
	tierEmoji := map[string]string{
		"beginner":     "🟢",
		"intermediate": "🔵",
		"advanced":     "🟠",
		"expert":       "🔴",
	}

	rows, err := db.Query(`
		SELECT dp.id, dp.tier, p.name, p.rating, p.url, p.tags, p."cfContestId", p."cfIndex"
		FROM daily_problems dp
		JOIN problems p ON p.id = dp."problemId"
		WHERE dp.date = CURRENT_DATE AND dp."discordPostedAt" IS NULL
		ORDER BY CASE dp.tier WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'advanced' THEN 3 WHEN 'expert' THEN 4 END
	`)
	if err != nil {
		return fmt.Errorf("query daily problems: %w", err)
	}
	defer rows.Close()

	type dbProblem struct {
		id, tier, name, url, tags, index string
		rating, contestID                int
	}

	var problems []dbProblem
	for rows.Next() {
		var p dbProblem
		if err := rows.Scan(&p.id, &p.tier, &p.name, &p.rating, &p.url, &p.tags, &p.contestID, &p.index); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}
		problems = append(problems, p)
	}

	if len(problems) == 0 {
		return nil
	}

	siteBase := getEnv("SITE_URL", "https://codeforces-practice.com")

	for _, p := range problems {
		emoji := tierEmoji[p.tier]
		color := tierColorInt(p.tier)
		siteURL := fmt.Sprintf("%s/problem/%s", siteBase, p.id)

		ps, scrapeErr := ScrapeProblem(p.contestID, p.index)

		embed := buildProblemEmbed(p.name, p.rating, siteURL, p.url, p.tags, emoji, color, ps, scrapeErr)

		_, err = s.ForumThreadStartEmbeds(channelID,
			fmt.Sprintf("%s %s — %s (Rating: %d)", emoji, p.tier[0:1]+p.tier[1:], p.name, p.rating),
			10080, []*discordgo.MessageEmbed{embed})
		if err != nil {
			log.Printf("Failed to create forum thread for %s: %v", p.name, err)
			return err
		}

		if _, err := db.Exec(`UPDATE daily_problems SET "discordPostedAt" = NOW() WHERE id = $1`, p.id); err != nil {
			log.Printf("Failed to mark %s as posted: %v", p.name, err)
		}
	}

	return nil
}

func buildProblemEmbed(name string, rating int, siteURL, cfURL, tags, emoji string, color int, ps *ProblemStatement, scrapeErr error) *discordgo.MessageEmbed {
	linkURL := siteURL
	if linkURL == "" {
		linkURL = cfURL
	}

	desc := fmt.Sprintf("%s **%s** (Rating: %d)\n\n**Tags:** %s", emoji, name, rating, CleanPgtags(tags))

	if scrapeErr != nil {
		desc += fmt.Sprintf("\n\n*Full statement couldn't be fetched.*\n[Open on DailyCodeforce](%s)", linkURL)
		return &discordgo.MessageEmbed{
			Title:       name,
			URL:         linkURL,
			Description: desc,
			Color:       color,
		}
	}

	if ps.TimeLimit != "" || ps.MemLimit != "" {
		desc += fmt.Sprintf("\n\n**Time:** %s · **Memory:** %s", ps.TimeLimit, ps.MemLimit)
	}

	if ps.Statement != "" {
		statement := ps.Statement
		desc += "\n\n" + statement
	}

	fullText := desc
	if len(fullText) > 4096 {
		desc = desc[:4093] + "..."
	}

	embed := &discordgo.MessageEmbed{
		Title:       name,
		URL:         linkURL,
		Description: desc,
		Color:       color,
	}

	if len(ps.Input) > 0 || len(ps.Output) > 0 {
		ioText := ""
		if ps.Input != "" {
			ioText += "**Input:**\n" + ps.Input + "\n\n"
		}
		if ps.Output != "" {
			ioText += "**Output:**\n" + ps.Output
		}
		if len(ioText) > 1024 {
			ioText = ioText[:1021] + "..."
		}
		embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
			Name:  "📥 Input / 📤 Output",
			Value: ioText,
		})
	}

	for idx, ex := range ps.Examples {
		if idx >= 2 {
			embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
				Name:  fmt.Sprintf("📎 +%d more examples", len(ps.Examples)-2),
				Value: fmt.Sprintf("[View all on DailyCodeforce →](%s)", linkURL),
			})
			break
		}
		example := fmt.Sprintf("**Input:**\n```\n%s\n```\n**Output:**\n```\n%s\n```", ex.Input, ex.Output)
		if len(example) > 1024 {
			example = example[:1021] + "..."
		}
		embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
			Name:  fmt.Sprintf("Example %d", idx+1),
			Value: example,
		})
	}

	if ps.Note != "" {
		note := ps.Note
		if len(note) > 1024 {
			note = note[:1021] + "..."
		}
		embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
			Name:  "💡 Note",
			Value: note,
		})
	}

	openValue := fmt.Sprintf("[Solve on DailyCodeforce →](%s)", linkURL)
	if siteURL != "" && cfURL != "" {
		openValue += fmt.Sprintf("\n[View original on Codeforces →](%s)", cfURL)
	}
	embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
		Name:  "Open Problem",
		Value: openValue,
	})

	return embed
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

func tierEmojiMap() map[string]string {
	return map[string]string{
		"beginner":     "🟢",
		"intermediate": "🔵",
		"advanced":     "🟠",
		"expert":       "🔴",
	}
}
