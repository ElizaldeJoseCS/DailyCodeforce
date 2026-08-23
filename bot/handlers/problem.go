package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"

	"github.com/bwmarrin/discordgo"
)

var cfURLPattern = regexp.MustCompile(`codeforces\.com/(?:problemset/)?problem/(\d+)/([A-Za-z0-9]+)`)
var cfIDPattern = regexp.MustCompile(`^(\d{4,6})([A-Za-z0-9]{1,3})$`)

func handleProblem(s *discordgo.Session, i *discordgo.InteractionCreate, db *sql.DB) {
	input := ""
	for _, opt := range i.ApplicationCommandData().Options {
		if opt.Name == "query" {
			input = strings.TrimSpace(opt.StringValue())
		}
	}

	if input == "" {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "Usage: `/problem <url_or_id>`\nExamples:\n- `/problem https://codeforces.com/problemset/problem/1579/E1`\n- `/problem 1579E1`\n- `/problem 1579/E1`",
			},
		})
		return
	}

	contestID, index := parseCFInput(input)
	if contestID == 0 || index == "" {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "Could not parse Codeforces problem. Use a URL like `https://codeforces.com/problemset/problem/1579/E1` or ID like `1579E1` or `1579/E1`.",
			},
		})
		return
	}

	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})

	ps, err := ScrapeProblem(contestID, index)
	if err != nil {
		log.Printf("Scrape failed for %d/%s: %v", contestID, index, err)
		editInteraction(s, i, fmt.Sprintf("Failed to fetch problem from Codeforces. Check the URL/ID and try again.\nError: %v", err))
		return
	}

	url := fmt.Sprintf("https://codeforces.com/problemset/problem/%d/%s", contestID, index)

	ratingColor := 0x6b7280
	embed := &discordgo.MessageEmbed{
		Title: fmt.Sprintf("%s (Rating: %d)", ps.Statement[:min(len(ps.Statement), 80)], 0),
		URL:   url,
		Color: ratingColor,
	}

	dbProblem, err := db.Query(`SELECT name, rating, tags FROM problems WHERE "cfContestId" = $1 AND "cfIndex" = $2`, contestID, index)
	if err == nil {
		defer dbProblem.Close()
		if dbProblem.Next() {
			var name string
			var rating int
			var tags string
			if dbProblem.Scan(&name, &rating, &tags) == nil {
				embed.Title = fmt.Sprintf("%s (Rating: %d)", name, rating)
				embed.Description = fmt.Sprintf("**Tags:** %s", tags)

				if rating < 1200 {
					ratingColor = 0x10b981
				} else if rating < 1600 {
					ratingColor = 0x3b82f6
				} else if rating < 2000 {
					ratingColor = 0xf97316
				} else {
					ratingColor = 0xef4444
				}
				embed.Color = ratingColor
			}
		}
	}

	if embed.Description == "" {
		embed.Description = fmt.Sprintf("**Contest:** %d | **Problem:** %s", contestID, index)
	}

	if ps.TimeLimit != "" {
		embed.Description += fmt.Sprintf("\n⏱ %s · 💾 %s", ps.TimeLimit, ps.MemLimit)
	}

	if ps.Statement != "" {
		statement := ps.Statement
		if len(statement) > 1024 {
			statement = statement[:1021] + "..."
		}
		embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
			Name:  "📝 Statement",
			Value: statement,
		})
	}

	if ps.Input != "" {
		input := ps.Input
		if len(input) > 1024 {
			input = input[:1021] + "..."
		}
		embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
			Name:  "📥 Input",
			Value: "```\n" + input + "\n```",
		})
	}

	if ps.Output != "" {
		output := ps.Output
		if len(output) > 1024 {
			output = output[:1021] + "..."
		}
		embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
			Name:  "📤 Output",
			Value: "```\n" + output + "\n```",
		})
	}

	for idx, ex := range ps.Examples {
		if idx >= 3 {
			remaining := len(ps.Examples) - 3
			embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
				Name:  fmt.Sprintf("📎 +%d more", remaining),
				Value: fmt.Sprintf("[View all examples on Codeforces →](%s)", url),
			})
			break
		}
		example := fmt.Sprintf("**Input:**\n```\n%s\n```\n**Output:**\n```\n%s\n```", ex.Input, ex.Output)
		if len(example) > 1024 {
			example = example[:1021] + "..."
		}
		embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
			Name:  fmt.Sprintf("📋 Example %d", idx+1),
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

	embed.Fields = append(embed.Fields, &discordgo.MessageEmbedField{
		Name:  "🔗 Solve it",
		Value: fmt.Sprintf("[Codeforces →](%s)", url),
	})

	editInteractionEmbed(s, i, embed)
}

func parseCFInput(input string) (int, string) {
	if matches := cfURLPattern.FindStringSubmatch(input); len(matches) == 3 {
		id, err := strconv.Atoi(matches[1])
		if err != nil {
			return 0, ""
		}
		return id, strings.ToUpper(matches[2])
	}

	input = strings.ReplaceAll(input, "/", "")

	if matches := cfIDPattern.FindStringSubmatch(input); len(matches) == 3 {
		id, err := strconv.Atoi(matches[1])
		if err != nil {
			return 0, ""
		}
		return id, strings.ToUpper(matches[2])
	}

	return 0, ""
}

func editInteraction(s *discordgo.Session, i *discordgo.InteractionCreate, content string) {
	s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
		Content: &content,
	})
}

func editInteractionEmbed(s *discordgo.Session, i *discordgo.InteractionCreate, embed *discordgo.MessageEmbed) {
	s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
		Embeds: &[]*discordgo.MessageEmbed{embed},
	})
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
