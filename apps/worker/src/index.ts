import "./queues/consumer";
import { writeHeartbeat } from "./services/heartbeat";

console.log("Bot Worker started");

// Heartbeat every 30s
setInterval(writeHeartbeat, 30000);
