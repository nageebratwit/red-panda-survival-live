# Red Panda Survival Adventure — Live Classroom Game

Based on the supplied 11-page Red Panda Science Lab Report (Activities 1.2–4.2).

## What is included
- Presenter-controlled host screen, six-digit PIN, and live QR code
- Players join by phone with a nickname, no account required
- Eight detailed learning missions, each with an audience survival vote and organism comparison prompt
- Fifteen final multiple-choice questions, 100 points per correct answer, live score leaderboard
- Host-controlled answer reveals and explanations

## Run locally
Install Node.js 20 or later. In this folder run `npm install`, then `npm start`, and open http://localhost:3000. Localhost alone is NOT accessible to your classmates' phones.

## Deploy on Render
1. Create a GitHub repository and upload `server.js`, `data.js`, `package.json`, `render.yaml`, `.gitignore`, and the complete `public` folder. Do not upload `node_modules` or `report.txt`.
2. In https://dashboard.render.com choose New → Web Service and connect the repository.
3. Select Node, build command `npm install`, start command `npm start`, and a plan you are comfortable with (a free plan may be available).
4. Wait for the deployment to complete. Open the HTTPS URL Render actually assigns. No URL is assigned in this package.
5. On your classroom laptop, click Create a live game. A real QR code for that hosted URL will appear, along with a six-digit PIN.
6. Students scan the code, enter nicknames, and join. Click Start the adventure; walk through the eight missions, let everyone vote, then start the 15-question final quiz.
7. Reveal answers and advance questions from the host screen. The leaderboard updates automatically.

## Important classroom notes
- Test with a laptop and a phone on mobile data before class.
- Keep the host browser and its local storage; the host token is stored there for reconnecting.
- Scores and rooms are stored in server memory only: server restart, redeploy, or service sleep can erase the current game. Use a reliable always-on hosting plan for important presentations.
- One server instance only. This version has no database, moderation, player authentication, or automatic timer; host advances manually.
- Students should use nicknames, not full names.
- Hosting services may change their free-plan availability, so verify your selected plan and charges before deployment.

## Red Panda themed 8-question edition
- All eight teaching missions remain, followed by eight final quiz questions (one per mission).
- Host can use **Back to main page (reset round)** from any game screen to return everyone to the joining lobby and reset scores.
- Existing joined players remain in the lobby; the same QR code and room number continue to work.
- Upload **the contents** of this folder to the existing GitHub repository root, replacing matching files. Render should redeploy after commit.


## 20-second mission voting update
Each survival vote starts a server-controlled 20-second timer. The host and students see a countdown, and results with the correct answer and explanation appear automatically at zero. The manual close/reveal and back-to-lesson controls during voting have been removed. Organism comparison discussion cards are removed. The eight final quiz questions still use their existing timing.


### Synchronized countdown
Host and phones use the same server-set deadline. Devices calibrate their clock offset against the server when connected and every 10 seconds using a round-trip midpoint estimate. The server closes voting at 20 seconds regardless of client clock settings. Network latency may cause a small visual difference.
