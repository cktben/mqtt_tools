#!/usr/bin/env python3

import argparse
import cmd
import json
import threading
import paho.mqtt.client as mqtt

class MQTTShell(cmd.Cmd):
    def __init__(self, client, username, host):
        super().__init__()

        self._client = client
        self._client.on_message = self._on_message

        # This tracks whether a prompt has been printed on the current line.
        # _on_message() uses this to move to the next line before
        # printing a message so the message is more readable, at the expense of making
        # a command being typed less readable.
        self._in_prompt = False

        self.prompt = 'MQTT: '
        if username:
            self.prompt += username + '@'

        self.prompt += '%s> ' % host

    def emptyline(self):
        pass

    def preloop(self):
        self._in_prompt = True

    def postloop(self):
        self._in_prompt = False

    def precmd(self, line):
        self._in_prompt = False
        return super().precmd(line)

    def postcmd(self, stop, line):
        self._in_prompt = True
        return super().postcmd(stop, line)

    def _on_message(self, client, userdata, message):
        text = '%s = %s' % (message.topic, message.payload.decode())
        if message.retain:
            text = '[' + text + ']'
        if self._in_prompt:
            text = '\n' + text
        print(text)
        self._in_prompt = False

    def do_EOF(self, line):
        print()
        return True

    def do_pub(self, line):
        '''pub <topic> <payload>
        Publishes a non-retained message.'''

        topic, payload = line.split(maxsplit=1)
        self._client.publish(topic, payload)

    def do_retain(self, line):
        '''retain <topic> <payload>
        Publishes a retained message.'''

        topic, payload = line.split(maxsplit=1)
        self._client.publish(topic, payload, retain=True)

    def do_sub(self, line):
        '''sub <topic>
        Subscribes to the given topic, which may be a pattern.'''

        self._client.subscribe(line)

    def do_unsub(self, line):
        '''unsub <topic>
        Unsubscribes from the given topic, which may be a pattern.'''

        self._client.unsubscribe(line)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-s', dest='sub', help='Subscribe to this topic', nargs='+', default=[])
    parser.add_argument('-m', '--mqtt-config', help='MQTT configuration file')
    args = parser.parse_args()

    if args.mqtt_config:
        with open(args.mqtt_config, 'r') as config_file:
            config = json.load(config_file)
    else:
        config = {}

    mqtt_client = mqtt.Client()
    username = config.get('username')
    if username:
        mqtt_client.username_pw_set(username, config.get('password'))
    if config.get('use_tls', False):
        mqtt_client.tls_set(config.get('ca_certs'), config.get('certfile'), config.get('keyfile'))
    host = config.get('host', 'localhost')
    mqtt_client.connect(host, config.get('port', 1883))
    mqtt_client.loop_start()

    for sub in args.sub:
        mqtt_client.subscribe(sub)

    MQTTShell(mqtt_client, username, host).cmdloop()
