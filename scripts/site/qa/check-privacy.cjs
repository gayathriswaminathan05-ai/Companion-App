// Choose checks matching the actual build. Neither suite uses owner data.
require(require("../../../electron/features.json").aiChat ? "./check-chat-privacy.cjs" : "./check-beta-without-chat.cjs");
