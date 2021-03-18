#!/usr/bin/env python3

import argparse
import json
import paho.mqtt.client as mqtt
import threading
import time

parser = argparse.ArgumentParser(description='Publishes from a JSON file or writes to JSON from retained messages.')
parser.add_argument('-m', '--mqtt-config', help='MQTT connection JSON file', required=True)
parser.add_argument('-t', '--timeout', help='Timeout for receiving all messages, in seconds', type=float, default=1)
parser.add_argument('-o', '--out', help='Output file for --update')
ops = parser.add_mutually_exclusive_group(required=True)
ops.add_argument('--load', help='Load from this JSON file')
ops.add_argument('--update', help='Update topics given in this JSON file')
args = parser.parse_args()

with open(args.mqtt_config, 'r') as f:
    mqtt_config = json.load(f)

client = mqtt.Client()
client.username_pw_set(mqtt_config['username'], mqtt_config['password'])
if mqtt_config.get('use_tls', False):
    client.tls_set(mqtt_config.get('ca_certs'))
client.connect(mqtt_config['host'], mqtt_config['port'])
client.loop_start()

if args.load:
    with open(args.load) as f:
        config = json.load(f)

    for topic, payload in config.items():
        client.publish(topic, payload, retain=True)

class MessageCollector:
    def __init__(self, client, topics):
        self._client = client
        self._remaining = set(topics)
        self._messages = {}
        self._done = threading.Condition()

    def on_message(self, client, userdata, msg):
        # Keep the first retained message of any desired topic.
        if msg.retain and msg.topic in self._remaining:
            self._messages.setdefault(msg.topic, msg.payload)
            self._remaining.remove(msg.topic)

            if not self._remaining:
                with self._done:
                    self._done.notify()

    def collect(self, timeout=1):
        old_listener = self._client.on_message
        self._client.on_message = self.on_message

        for topic in self._remaining:
            self._client.subscribe(topic)

        with self._done:
            self._done.wait(timeout)

        self._client.on_message = old_listener
        return self._messages

def decode_payload(payload):
    text = payload.decode()
    try:
        obj = json.loads(text)
        return obj
    except:
        return text

if args.update:
    with open(args.update) as f:
        config = json.load(f)

    if not config:
        print('Configuration file has no topics!')
    else:
        collector = MessageCollector(client, config.keys())
        updated = collector.collect(args.timeout)

        config.update({topic: decode_payload(payload) for topic, payload in updated.items()})

        with open(args.out or args.update, 'w') as f:
            json.dump(config, f)

client.disconnect()
