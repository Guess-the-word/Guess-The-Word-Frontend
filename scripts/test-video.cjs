// Requires a running frontend/backend and optional Playwright + Chrome.
// Uses fake media devices; never opens a real camera or microphone.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const url = process.env.APP_URL || "http://localhost:3000";
const room = `vid${Date.now().toString(36).slice(-6)}`;
const errors = [];
const button = (page, name) => page.getByRole("button", { name, exact: true });
const camera = (page) => page.getByLabel("Your camera", { exact: true });
const video = (page, name) =>
  page.getByLabel(`${name}'s video`, { exact: true });
async function playing(page, name) {
  await video(page, name).waitFor();
  await page.waitForFunction(
    (label) => {
      const element = Array.from(document.querySelectorAll("video")).find(
        (item) => item.getAttribute("aria-label") === label
      );
      return (
        element &&
        element.videoWidth > 0 &&
        !element.paused &&
        element.getVideoPlaybackQuality().totalVideoFrames > 3
      );
    },
    `${name}'s video`,
    { timeout: 20000 }
  );
}
async function trackCount(page, name, kind, count) {
  await page.waitForFunction(
    ({ label, kind, count }) => {
      const element = Array.from(document.querySelectorAll("video")).find(
        (item) => item.getAttribute("aria-label") === label
      );
      return (
        element &&
        (element.srcObject
          ?.getTracks()
          .filter((track) => track.kind === kind && track.readyState === "live")
          .length || 0) === count
      );
    },
    { label: `${name}'s video`, kind, count },
    { timeout: 20000 }
  );
}
(async () => {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "chrome",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  const contexts = [];
  async function join(name, denyCamera = false) {
    const context = await browser.newContext({
      permissions: ["camera", "microphone"],
      viewport: { width: 1280, height: 1000 },
    });
    contexts.push(context);
    await context.addInitScript(
      ({ denyCamera }) => {
        window.mediaRequests = [];
        window.capturedTracks = [];
        const original = navigator.mediaDevices.getUserMedia.bind(
          navigator.mediaDevices
        );
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          window.mediaRequests.push(constraints);
          if (denyCamera && constraints.video)
            throw new DOMException("Test denial", "NotAllowedError");
          const stream = await original(constraints);
          window.capturedTracks.push(...stream.getTracks());
          return stream;
        };
      },
      { denyCamera }
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.getByPlaceholder("Enter Room Name (4-10 characters)").fill(room);
    await page.getByPlaceholder("Display Name (optional)").fill(name);
    await page.getByRole("button", { name: /Join Game/ }).click();
    await button(page, "Turn camera on").waitFor();
    return page;
  }
  try {
    const a = await join("Alex");
    assert.deepEqual(await a.evaluate(() => window.mediaRequests), []);
    await button(a, "Turn camera on").click();
    await button(a, "Turn camera off").waitFor();
    assert.deepEqual(await a.evaluate(() => window.mediaRequests), [
      { video: true, audio: false },
    ]);
    await camera(a).evaluate((element) => {
      if (!element.srcObject) throw new Error("No local preview");
    });
    const b = await join("Blair");
    await playing(b, "Alex");
    assert.deepEqual(await b.evaluate(() => window.mediaRequests), []);
    console.log(
      "PASS: camera alone starts, late viewer receives real frames without requesting camera/mic"
    );

    await button(b, "Turn camera on").click();
    await playing(a, "Blair");
    await button(a, "Turn microphone on").click();
    await trackCount(b, "Alex", "audio", 1);
    await playing(b, "Alex");
    await button(b, "Turn room sound on").click();
    await video(b, "Alex").evaluate((element) => {
      if (element.muted) throw new Error("Room sound stayed muted");
    });
    await button(a, "Turn camera off").click();
    await trackCount(b, "Alex", "video", 0);
    await trackCount(b, "Alex", "audio", 1);
    await playing(a, "Blair");
    await button(a, "Mute microphone").click();
    await trackCount(b, "Alex", "audio", 0);
    await button(a, "Turn camera on").click();
    await playing(b, "Alex");
    console.log(
      "PASS: two-way video, independent mic, sound, camera off with mic on, restart"
    );

    const c = await join("Casey");
    await playing(c, "Alex");
    await playing(c, "Blair");
    await video(b, "Alex").evaluate((element) => {
      window.beforeReconnect = element.srcObject;
    });
    await b.getByText("Audio & video help", { exact: true }).click();
    await button(b, "Reconnect video").click();
    await b.waitForFunction(() => {
      const element = document.querySelector(
        'video[aria-label="Alex\'s video"]'
      );
      return element?.srcObject && element.srcObject !== window.beforeReconnect;
    });
    await playing(b, "Alex");
    await b.reload();
    await button(b, "Turn camera on").waitFor();
    await playing(b, "Alex");
    assert.deepEqual(await b.evaluate(() => window.mediaRequests), []);
    console.log(
      "PASS: third-player late join, reconnect, refresh without reopening devices"
    );

    await video(c, "Alex").evaluate((element) => {
      window.beforeMatch = element.srcObject;
    });
    await button(a, "Start match").click();
    await a.getByText("Round 1 of 3", { exact: false }).first().waitFor();
    await button(a, "Correct · +1 to Team 1").waitFor();
    await button(a, "Correct · +1 to Team 1").click();
    await a.getByText("Team 2, you’re up.", { exact: true }).waitFor();
    await a.waitForFunction(() => {
      const timer = document.querySelector('[role="timer"]');
      return timer?.getAttribute("aria-label")?.includes("seconds remaining") &&
        parseInt(timer.querySelector("strong")?.textContent || "", 10) < 59;
    });
    assert.equal(
      await video(c, "Alex").evaluate(
        (element) => element.srcObject === window.beforeMatch
      ),
      true
    );
    await playing(c, "Alex");
    await c.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await c.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      true
    );
    await c.getByRole("region", { name: "Video room" }).screenshot({
      path: process.env.VIDEO_SCREENSHOT || "/tmp/guess-video-controls.png",
    });
    console.log(
      "PASS: gameplay preserves video streams; mobile controls fit at 390px"
    );

    await a.getByRole("button", { name: /Leave room/i }).click();
    await a.getByPlaceholder("Enter Room Name (4-10 characters)").waitFor();
    assert.equal(
      await a.evaluate(() =>
        window.capturedTracks.every((track) => track.readyState === "ended")
      ),
      true
    );
    await video(c, "Alex").waitFor({ state: "detached" });
    const denied = await join("Dana", true);
    await button(denied, "Turn camera on").click();
    await denied
      .getByRole("alert")
      .filter({ hasText: "Camera access was blocked" })
      .waitFor();
    await button(denied, "Turn microphone on").click();
    await button(denied, "Mute microphone").waitFor();
    await trackCount(c, "Dana", "audio", 1);
    console.log(
      "PASS: leaving releases devices; camera denial has useful feedback and does not block mic"
    );
    assert.deepEqual(errors, []);
    console.log("PASS: no uncaught browser errors");
  } catch (error) {
    console.error(error);
    for (const context of contexts) {
      for (const page of context.pages())
        console.error((await page.locator("body").innerText()).slice(-2200));
    }
    console.error("Browser errors:", errors);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
