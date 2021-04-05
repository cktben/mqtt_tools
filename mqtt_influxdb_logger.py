import argparse
from influxdb import InfluxDBClient
import json
import paho.mqtt.client as mqtt

def is_primitive(value):
    return isinstance(value, int) or isinstance(value, float) or isinstance(value, str)

def message_fields(payload):
    payload = payload.decode()
    try:
        obj = json.loads(payload)
    except:
        return {'value': payload}

    if isinstance(obj, dict):
        fields = {}
        for key, value in obj.items():
            if is_primitive(value):
                fields[key] = value
            else:
                return {'value': payload}
        return fields
    elif is_primitive(obj):
        return {'value': obj}
    else:
        return {'value': payload}

class MQTT_InfluxDB_Logger:
    def __init__(self, config, mqtt_config, influxdb_config):
        self.verbose = False
        self._config = config
        self._mqtt_config = mqtt_config
        self._influxdb_config = influxdb_config

    def connect_mqtt(self):
        self._mqtt = mqtt.Client()
        self._mqtt.on_message = self._on_message
        username = self._mqtt_config.get('username')
        if username:
            self._mqtt.username_pw_set(username, self._mqtt_config.get('password'))
        if self._mqtt_config.get('use_tls', False):
            self._mqtt.tls_set(self._mqtt_config.get('ca_certs'), self._mqtt_config.get('certfile'), self._mqtt_config.get('keyfile'))
        self._mqtt.connect(self._mqtt_config.get('host', 'localhost'), self._mqtt_config.get('port', 1883))

        for topic in self._config.get('topics', []):
            self._mqtt.subscribe(topic)

    def connect_influxdb(self):
        self._influxdb = InfluxDBClient(
            host=self._influxdb_config.get('host', 'localhost'),
            port=self._influxdb_config.get('port', 8086),
            username=self._influxdb_config.get('username', 'root'),
            password=self._influxdb_config.get('password', 'root'),
            database=self._config.get('influxdb_database', self._influxdb_config.get('database', None)),
            ssl=self._influxdb_config.get('ssl', False),
            verify_ssl=self._influxdb_config.get('verify_ssl', True))

    def _on_message(self, client, userdata, msg):
        if msg.retain and not self._config.get('log_retained', False):
            return

        fields = message_fields(msg.payload)
        points = [{
            'measurement': msg.topic,
            'fields': fields
        }]
        if self.verbose:
            print(points)
        self._influxdb.write_points(points)

    def run(self):
        self._mqtt.loop_forever()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Logs MQTT messages to an InfluxDB database.')
    parser.add_argument('-c', '--config', help='Configuration file', default='logger.json')
    parser.add_argument('-m', '--mqtt-config', help='MQTT configuration file')
    parser.add_argument('-i', '--influxdb-config', help='InfluxDB configuration file')
    parser.add_argument('-v', help='Verbose', action='store_true', dest='verbose')
    args = parser.parse_args()

    if args.mqtt_config:
        with open(args.mqtt_config, 'r') as f:
            mqtt_config = json.load(f)
    else:
        mqtt_config = {}

    if args.influxdb_config:
        with open(args.influxdb_config, 'r') as f:
            influxdb_config = json.load(f)
    else:
        influxdb_config = {}

    with open(args.config, 'r') as f:
        config = json.load(f)

    logger = MQTT_InfluxDB_Logger(config, mqtt_config, influxdb_config)
    logger.verbose = args.verbose
    logger.connect_mqtt()
    logger.connect_influxdb()
    logger.run()
