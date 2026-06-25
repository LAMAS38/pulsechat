import { createApp } from "./routes";
import { ChatRoom } from "./durable-objects/ChatRoom";

const app = createApp();

export default {
  fetch: app.fetch,
};

export { ChatRoom };
