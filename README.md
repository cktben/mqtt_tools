These are some general purpose tools for working with MQTT.

- **websockets_client** is a web-based client that connects to a websockets-capable MQTT
broker.  It allows subscribing and publishing.  It present the most recent message
for each subscription and, optionally, the history of all subscribed messages.
A message can be edited and re-published easily.  It does not require a server - it may be run
from local files by simply pointing a browser at the HTML file, as long as the .js file is also accessible.
- **mqtt_shell.py** is a simple command-line tool for subscribing and publishing.
- **mqtt_json_state.py** moves messages between a list stored in a JSON file and an MQTT broker.
It can be used to load a default set of retained messages and save them again, for example
to keep a system's default configuration in version control.

## MQTT Client Configuration Files

The Python tools in this repository read credentials and broker configuration from a JSON file.
This is simpler than requiring many command-line arguments and allows the configuration to be
easily shared among many programs.

The configuration file contains a JSON object with the following fields:
- **host** (required): The hostname or address of the broker.
- **port**: The port number of the broker on its host.  If not given, this defaults to 1883.
- **username**: The username used to authenticate with the broker.
- **password**: The password used to authenticate with the broker.
- **use_tls**: If True, connect to the broker with TLS.
- **ca_certs**: Path to a file containing CA certificates for the broker when using TLS.
