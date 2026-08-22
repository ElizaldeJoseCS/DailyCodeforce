package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
)

type ProblemStatement struct {
	Statement string
	Input     string
	Output    string
	Examples  []Example
	Note      string
	TimeLimit string
	MemLimit  string
}

type Example struct {
	Input  string
	Output string
}

var (
	scrapeCache   = map[string]*ProblemStatement{}
	scrapeCacheMu sync.RWMutex
)

func ScrapeProblem(contestID int, index string) (*ProblemStatement, error) {
	key := fmt.Sprintf("%d%s", contestID, index)

	scrapeCacheMu.RLock()
	if cached, ok := scrapeCache[key]; ok {
		scrapeCacheMu.RUnlock()
		return cached, nil
	}
	scrapeCacheMu.RUnlock()

	url := fmt.Sprintf("https://codeforces.com/problemset/problem/%d/%s", contestID, index)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "DailyCodeforceBot/1.0 (github.com/ElizaldeJoseCS/DailyCodeforce)")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch page: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d from codeforces", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("parse html: %w", err)
	}

	ps := &ProblemStatement{}

	problemDiv := doc.Find("div.problem-statement")
	if problemDiv.Length() == 0 {
		return nil, fmt.Errorf("could not find problem statement div")
	}

	ps.TimeLimit = cleanText(problemDiv.Find("div.header").Find("div.time-limit").Text())
	ps.MemLimit = cleanText(problemDiv.Find("div.header").Find("div.memory-limit").Text())

	ps.Statement = cleanText(problemDiv.Find("div.header").Next().Text())

	ps.Input = cleanText(problemDiv.Find("div.input-specification").Text())
	ps.Output = cleanText(problemDiv.Find("div.output-specification").Text())

	problemDiv.Find("div.sample-tests").Each(func(i int, s *goquery.Selection) {
		inputEl := s.Find("div.input")
		outputEl := s.Find("div.output")

		input := cleanText(inputEl.Find("pre").Text())
		output := cleanText(outputEl.Find("pre").Text())

		if input != "" || output != "" {
			ps.Examples = append(ps.Examples, Example{Input: input, Output: output})
		}
	})

	ps.Note = cleanText(problemDiv.Find("div.note").Text())

	scrapeCacheMu.Lock()
	scrapeCache[key] = ps
	scrapeCacheMu.Unlock()

	log.Printf("Scraped problem %d%s: %d examples", contestID, index, len(ps.Examples))

	return ps, nil
}

func cleanText(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "$$$", "")
	lines := strings.Split(s, "\n")
	var cleaned []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			cleaned = append(cleaned, line)
		}
	}
	return strings.Join(cleaned, "\n")
}
