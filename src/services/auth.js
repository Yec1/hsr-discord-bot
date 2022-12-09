import play from "play-dl";

play.getFreeClientID().then(clientID => {
	play.setToken({
		soundcloud: {
			client_id: clientID
		}
	});
});
