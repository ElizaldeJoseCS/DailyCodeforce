package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"dailycodeforce-bot/handlers"

	"github.com/bwmarrin/discordgo"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	godotenv.Load()

	token := os.Getenv("DISCORD_BOT_TOKEN")
	if token == "" {
		log.Fatal("DISCORD_BOT_TOKEN is required")
	}

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_PORT", "5432"),
		getEnv("DB_USER", "dailycodeforce"),
		getEnv("DB_PASSWORD", "dcf_dev_password"),
		getEnv("DB_NAME", "dailycodeforce"),
	)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}
	log.Println("Connected to database")

	dg, err := discordgo.New("Bot " + token)
	if err != nil {
		log.Fatal("Failed to create Discord session:", err)
	}

	dg.AddHandler(handlers.OnReady)
	dg.AddHandler(handlers.OnInteractionCreate(db))

	dg.Identify.Intents = discordgo.IntentsGuilds

	err = dg.Open()
	if err != nil {
		log.Fatal("Failed to open Discord connection:", err)
	}
	defer dg.Close()

	handlers.RegisterCommands(dg)

	log.Println("Bot is running. Press Ctrl+C to exit.")

	go startDailyNotifier(dg, db)

	sc := make(chan os.Signal, 1)
	signal.Notify(sc, syscall.SIGINT, syscall.SIGTERM)
	<-sc

	log.Println("Shutting down...")
	handlers.UnregisterCommands(dg)
}

func startDailyNotifier(dg *discordgo.Session, db *sql.DB) {
	channelID := os.Getenv("NOTIFICATION_CHANNEL_ID")
	if channelID == "" {
		log.Println("No NOTIFICATION_CHANNEL_ID set, daily notifications disabled")
		return
	}

	for {
		now := time.Now()
		target := time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, time.UTC)
		if now.After(target) {
			target = target.Add(24 * time.Hour)
		}

		time.Sleep(time.Until(target))

		if err := handlers.SendDailyNotification(dg, db, channelID); err != nil {
			log.Printf("Failed to send daily notification: %v", err)
		}
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
