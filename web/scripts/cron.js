const { execSync } = require("child_process");

function msUntilMidnightUTC() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

function run() {
  console.log(`[${new Date().toISOString()}] Running daily job...`);
  try {
    const out = execSync("/app/scripts/daily.sh", {
      cwd: "/app",
      stdio: "inherit",
      env: process.env,
    });
    console.log(`[${new Date().toISOString()}] Done!`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
  }
}

function scheduleNext() {
  const ms = msUntilMidnightUTC();
  const hours = (ms / 3600000).toFixed(1);
  console.log(`[${new Date().toISOString()}] Sleeping ${hours}h until midnight UTC...`);
  setTimeout(() => {
    run();
    scheduleNext();
  }, ms);
}

// Run immediately on first start, then schedule
run();
scheduleNext();
