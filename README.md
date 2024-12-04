# Last.FM Now Playing WebSocket

## Opcodes

- -1 - Error
- 0 - Message from the server (data or init)
- 1 - Ping
- 2 - Subscribe
- 3 - Unsubscribe

## Sending data

### Sending a ping

```json
{ "op": 1 }
```

### Subscribing to a user

```json
{ "op": 2, "d": { "user": "sampleuser" } }
```

### Unsubscribing from a user

```json
{ "op": 3, "d": { "user": "sampleuser" } }
```

## Recieving data

You will recieve a message like this when opening the websocket:

```json
{ "op": 0, "d": { "pingInterval": 30000 } }
```

You'll need to send a [ping message](#sending-a-ping) every `pingInterval` seconds to keep the connection alive.

### Now playing

The socket will send a message like this when a user starts playing a track:

```json
{
  "op": 3,
  "d": {
    "user": "sampleuser",
    "track": {
      "album": {
        "mbid": "7a1e6504-8398-4533-9adf-2a58217d80ab",
        "name": "Jungle"
      },
      "artist": { "mbid": "", "name": "Alok, The Chainsmokers & Mae Stephens" },
      "images": [
        {
          "size": "small",
          "url": "https://lastfm.freetls.fastly.net/i/u/34s/3ac5697b9089eeb4f107ded75797c13e.jpg"
        },
        {
          "size": "medium",
          "url": "https://lastfm.freetls.fastly.net/i/u/64s/3ac5697b9089eeb4f107ded75797c13e.jpg"
        },
        {
          "size": "large",
          "url": "https://lastfm.freetls.fastly.net/i/u/174s/3ac5697b9089eeb4f107ded75797c13e.jpg"
        },
        {
          "size": "extralarge",
          "url": "https://lastfm.freetls.fastly.net/i/u/300x300/3ac5697b9089eeb4f107ded75797c13e.jpg"
        }
      ],
      "name": "Jungle",
      "mbid": "e1804a86-7653-4603-ad0d-c70d49c99358",
      "url": "https://www.last.fm/music/Alok,+The+Chainsmokers+&+Mae+Stephens/_/Jungle",
      "nowplaying": "true"
    }
  }
}
```

### Errors

Fatal errors (that will close the websocket) will be sent like this:

```json
{
  "op": -1,
  "d": {
    "error": "Something really bad happened"
  }
}
```

Issues relating to retrieval of data (like a user not having any recent tracks) will be sent like this:

```json
{
  "op": 3,
  "d": {
    "user": "sampleuser",
    "error": "User has no recent tracks"
  }
}
```
