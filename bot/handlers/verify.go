package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/bwmarrin/discordgo"
)

type cfUserInfo struct {
	Handle        string `json:"handle"`
	FirstName     string `json:"firstName"`
	LastName      string `json:"lastName"`
	MaxRating     int    `json:"maxRating"`
	Rank          string `json:"rank"`
}

type cfApiResponse struct {
	Status string       `json:"status"`
	Result []cfUserInfo `json:"result"`
}

func handleVerify(s *discordgo.Session, i *discordgo.InteractionCreate, db *sql.DB) {
	sub := ""
	if len(i.ApplicationCommandData().Options) > 0 {
		sub = i.ApplicationCommandData().Options[0].StringValue()
	}

	switch sub {
	case "start":
		handleVerifyStart(s, i, db)
	case "confirm":
		handleVerifyConfirm(s, i, db)
	default:
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "Usage: `/verify start handle:<cf_handle>` or `/verify confirm`",
			},
		})
	}
}

func handleVerifyStart(s *discordgo.Session, i *discordgo.InteractionCreate, db *sql.DB) {
	discordID := i.Member.User.ID

	var handle string
	for _, opt := range i.ApplicationCommandData().Options {
		if opt.Name == "handle" {
			handle = opt.StringValue()
		}
	}
	if handle == "" {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ Please provide your Codeforces handle: `/verify start handle:<your_handle>`",
			},
		})
		return
	}

	var existingUser string
	err := db.QueryRow(`SELECT username FROM users WHERE "cfHandle" = $1 AND "discordId" != $2`, handle, discordID).Scan(&existingUser)
	if err == nil {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: fmt.Sprintf("❌ Handle **%s** is already linked to another Discord account. Contact a mod if this is an error.", handle),
			},
		})
		return
	}

	resp, err := http.Get(fmt.Sprintf("https://codeforces.com/api/user.info?handles=%s", handle))
	if err != nil {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ Could not reach Codeforces API. Please try again later.",
			},
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var apiResp cfApiResponse
	if err := json.Unmarshal(body, &apiResp); err != nil || apiResp.Status != "OK" {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: fmt.Sprintf("❌ Handle **%s** not found on Codeforces. Check the spelling and try again.", handle),
			},
		})
		return
	}

	token := generateVerifyToken()

	db.Exec(`DELETE FROM cf_verifications WHERE "discordId" = $1`, discordID)

	_, err = db.Exec(`
		INSERT INTO cf_verifications ("discordId", "handle", token, "expiresAt")
		VALUES ($1, $2, $3, $4)
	`, discordID, handle, token, time.Now().Add(15*time.Minute))
	if err != nil {
		log.Printf("Error inserting verify token: %v", err)
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ Failed to create verification token. Please try again.",
			},
		})
		return
	}

	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Content: fmt.Sprintf(
				"🔐 **Verify your Codeforces handle**\n\n"+
					"1. Go to [Codeforces Settings](https://codeforces.com/settings/profile)\n"+
					"2. Set your **First name** to exactly: `%s`\n"+
					"3. Save changes\n"+
					"4. Run `/verify confirm`\n\n"+
					"⏰ Token expires in **15 minutes**.\n"+
					"You can revert your name after verification.",
				token,
			),
		},
	})
}

func handleVerifyConfirm(s *discordgo.Session, i *discordgo.InteractionCreate, db *sql.DB) {
	discordID := i.Member.User.ID

	var handle, token string
	var expiresAt time.Time
	err := db.QueryRow(`
		SELECT handle, token, "expiresAt"
		FROM cf_verifications
		WHERE "discordId" = $1
		ORDER BY "expiresAt" DESC
		LIMIT 1
	`, discordID).Scan(&handle, &token, &expiresAt)
	if err == sql.ErrNoRows {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ No pending verification. Run `/verify start handle:<your_handle>` first.",
			},
		})
		return
	}

	if time.Now().After(expiresAt) {
		db.Exec(`DELETE FROM cf_verifications WHERE "discordId" = $1`, discordID)
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "⏰ Verification token expired. Run `/verify start` again to generate a new one.",
			},
		})
		return
	}

	resp, err := http.Get(fmt.Sprintf("https://codeforces.com/api/user.info?handles=%s", handle))
	if err != nil {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ Could not reach Codeforces API. Please try again in a minute.",
			},
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var apiResp cfApiResponse
	if err := json.Unmarshal(body, &apiResp); err != nil || apiResp.Status != "OK" || len(apiResp.Result) == 0 {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ Failed to fetch your Codeforces profile. Please try again.",
			},
		})
		return
	}

	cfUser := apiResp.Result[0]
	matched := strings.TrimSpace(cfUser.FirstName) == token

	if !matched {
		s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "❌ Token not found in your Codeforces first name. Make sure you saved the changes and wait a minute for CF to update, then try `/verify confirm` again.",
			},
		})
		return
	}

	_, err = db.Exec(`UPDATE users SET "cfHandle" = $1 WHERE "discordId" = $2`, handle, discordID)
	if err != nil {
		log.Printf("Error updating cfHandle: %v", err)
	}

	db.Exec(`DELETE FROM cf_verifications WHERE "discordId" = $1`, discordID)

	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Content: fmt.Sprintf(
				"✅ **Verified!** Your Discord account is now linked to Codeforces handle **%s** (Rating: %d, Rank: %s).\n\nYou can now revert your Codeforces name back to normal.",
				cfUser.Handle, cfUser.MaxRating, cfUser.Rank,
			),
		},
	})
}

func generateVerifyToken() string {
	const prefix = "df-"
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 6)
	rand.Read(b)
	for i := range b {
		b[i] = chars[b[i]%byte(len(chars))]
	}
	return prefix + string(b)
}
