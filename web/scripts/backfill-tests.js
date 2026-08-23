const { PrismaClient } = require('./src/generated/prisma/client');
const { load } = require('cheerio');

const prisma = new PrismaClient();

async function scrapeTestCases(contestId, index) {
  const url = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'DailyCodeforceBot/1.0' } });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = load(html);
  const examples = [];
  $('div.sample-tests').each((_, el) => {
    const input = $(el).find('div.input pre').text().trim();
    const output = $(el).find('div.output pre').text().trim();
    if (input || output) examples.push({ input, output });
  });
  return examples;
}

async function main() {
  const problems = await prisma.problem.findMany({
    where: { testCases: null },
    select: { id: true, cfContestId: true, cfIndex: true, name: true },
  });

  console.log(`Found ${problems.length} problems without test cases`);

  for (const p of problems) {
    try {
      const testCases = await scrapeTestCases(p.cfContestId, p.cfIndex);
      if (testCases.length > 0) {
        await prisma.problem.update({
          where: { id: p.id },
          data: { testCases: JSON.parse(JSON.stringify(testCases)) },
        });
        console.log(`✅ ${p.name} (${p.cfContestId}${p.cfIndex}): ${testCases.length} tests`);
      } else {
        console.log(`⚠️ ${p.name}: no test cases found`);
      }
    } catch (e) {
      console.error(`❌ ${p.name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  await prisma.$disconnect();
}

main();
