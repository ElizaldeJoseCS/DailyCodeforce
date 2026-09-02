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
	name := fmt.Sprintf("%d/%s", contestID, index)
	rating := 0
	var tags string

	dbProblem, err := db.Query(`SELECT name, rating, tags FROM problems WHERE "cfContestId" = $1 AND "cfIndex" = $2`, contestID, index)
	if err == nil {
		defer dbProblem.Close()
		if dbProblem.Next() {
			if dbProblem.Scan(&name, &rating, &tags) == nil {
				if rating < 1200 {
					ratingColor = 0x10b981
				} else if rating < 1600 {
					ratingColor = 0x3b82f6
				} else if rating < 2000 {
					ratingColor = 0xf97316
				} else {
					ratingColor = 0xef4444
				}
			}
		}
	}

	var siteURL string
	var dpID string
	if err := db.QueryRow(`
		SELECT dp.id FROM daily_problems dp
		JOIN problems p ON p.id = dp."problemId"
		WHERE p."cfContestId" = $1 AND p."cfIndex" = $2
		ORDER BY dp.date DESC LIMIT 1
	`, contestID, index).Scan(&dpID); err == nil && dpID != "" {
		siteURL = fmt.Sprintf("%s/problem/%s", getEnv("SITE_URL", "https://codeforces-practice.com"), dpID)
	}

	emoji := ""
	embed := buildProblemEmbed(name, rating, siteURL, url, tags, emoji, ratingColor, ps, nil)
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
