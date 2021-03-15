var client = null;
var recentPayloadRows = {};
var subscriptionRows = {};

var Disconnected = 0;
var Connecting = 1;
var Connected = 2;
var connectionState = -1;
var connectionError = null;

function changeConnectionState(state) {
    if (connectionState != state) {
        connectionState = state;

        var status = $('#connection-status');

        switch (connectionState) {
            case Disconnected:
                if (connectionError) {
                    status.removeClass('connected');
                    status.removeClass('connecting');
                    status.addClass('connection-failed');
                    status.text(connectionError);
                } else {
                    status.removeClass('connected');
                    status.removeClass('connecting');
                    status.removeClass('connection-failed');
                    status.text('Disconnected');
                }

                $('#connect').prop('disabled', false);
                $('#disconnect').prop('disabled', true);
                $('#subscribe').prop('disabled', true);
                $('#publish').prop('disabled', true);

                subscriptionRows = {};
                $('#subscriptions tbody tr').remove();
                break;

            case Connecting:
                status.removeClass('connected');
                status.addClass('connecting');
                status.removeClass('connection-failed');
                status.text('Connecting...');
                $('#connect').prop('disabled', true);
                $('#disconnect').prop('disabled', false);
                $('#subscribe').prop('disabled', true);
                $('#publish').prop('disabled', true);
                break;

            case Connected:
                status.addClass('connected');
                status.removeClass('connecting');
                status.removeClass('connection-failed');
                status.text('Connected');
                $('#connect').prop('disabled', true);
                $('#disconnect').prop('disabled', false);
                $('#subscribe').prop('disabled', false);
                $('#publish').prop('disabled', false);
                break;
        }
    }
}

function flash(element) {
    element.addClass('flash');
    setTimeout(function() {
        element.removeClass('flash');
    }, 100);
}

function startEditing(topic, row) {
    row.find('.display').hide();
    row.find('.editor').show();
    row.find('.retained input').prop('disabled', false);
    row.find('.edit-payload')[0].value = row.find('.content').text();
}

function stopEditing(row) {
    row.find('.display').show();
    row.find('.editor').hide();
    row.find('.retained input').prop('disabled', true);
}

function publishEdited(topic, row) {
    var payload = row.find('.edit-payload')[0].value;
    var retain = row.find('.retained input')[0].checked;
    var qos = parseInt(row.find('.qos input')[0].value);
    client.publish(topic, payload, {qos: qos, retain: retain});
    stopEditing(row);
}

function formatNumber(value, digits) {
    return value.toString().padStart(digits, '0');
}

function currentTimeString() {
    var time = new Date();
    return time.getFullYear().toString() + '-' +
        formatNumber(time.getMonth() + 1, 2) + '-' +
        formatNumber(time.getDate(), 2) + ' ' +
        formatNumber(time.getHours(), 2) + ':' +
        formatNumber(time.getMinutes(), 2) + ':' +
        formatNumber(time.getSeconds(), 2);
}

function messageReceived(topic, payload, msg) {
    var row = recentPayloadRows[topic];
    if (!row) {
        row = $('<tr class="topic"></tr>');
        var tdName = $('<td class="topic"></td>')
        var tdPayload = $('<td class="payload"><div class="display"><span class="content"></span><span class="start-edit button">&#x270e;</span></div>' +
            '<div class="editor"><span title="Cancel" class="edit-cancel button">&#x274c;</span><span title="Publish" class="edit-publish button">&#x2b95;</span>' +
            '<div class="edit-payload-container"><input class="edit-payload"></div></td>');
        var tdQoS = $('<td class="qos"><div class="display"><span></span></div><div class="editor"><input class="qos" type="number" min="0" max="2"></div></td>');
        var tdRetained = $('<td class="retained"><input type="checkbox" disabled="true"></td>');
        tdName.text(topic);
        row.append(tdName);
        row.append(tdPayload);
        row.append(tdQoS);
        row.append(tdRetained);
        row.find('.edit-cancel').click(function() { stopEditing(row); });
        row.find('.edit-publish').click(function() { publishEdited(topic, row); });
        tdPayload.find('.start-edit').click(function() { startEditing(topic, row); });
        $('#recent-payloads tbody').append(row);
        recentPayloadRows[topic] = row;
    }
    row.find('.payload .content').text(payload);
    row.find('.retained input')[0].checked = msg.retain;
    row.find('.qos input')[0].value = msg.qos;
    row.find('.qos .display span').text(msg.qos);

    flash(row);

    if ($('#history-enable')[0].checked) {
        var trHistory = $('<tr></tr>');
        var tdTime = $('<td class="time"></td>');
        var tdTopic = $('<td class="topic"></td>');
        var tdPayload = $('<td class="payload"></td>');
        var tdQoS = $('<td class="qos"></td>');
        var tdRetained = $('<td class="retained"></td>');
        tdTime.text(currentTimeString());
        tdTopic.text(topic);
        tdPayload.text(payload);
        tdQoS.text(msg.qos);
        if (msg.retained) {
            tdRetained.html("&#x2713;");
        }
        trHistory.append(tdTime);
        trHistory.append(tdTopic);
        trHistory.append(tdPayload);
        trHistory.append(tdQoS);
        trHistory.append(tdRetained);
        $('#history tbody').append(trHistory);
    }
}

$(document).ready(function() {
    changeConnectionState(Disconnected);

    $('#connect').click(function() {
        $('#connect').prop('disabled', true);

        if (client) {
            client.end();
        }

        client = mqtt.connect({
            host: $('#connect-host')[0].value,
            port: parseInt($('#connect-port')[0].value),
            protocol: $('#connect-tls')[0].checked ? 'wss' : 'ws',
            username: $('#connect-username')[0].value,
            password: $('#connect-password')[0].value
        });

        changeConnectionState(Connecting);

        client.on('connect', function() {
            changeConnectionState(Connected);
        });

        client.on('error', function(error) {
            connectionError = error.toString();
            changeConnectionState(Disconnected);

            // Don't keep trying to reconnect.
            client.end();
            client = null;
        });

        client.on('close', function() {
            changeConnectionState(Disconnected);
        });

        client.on('message', messageReceived);
    });

    $('#disconnect').click(function() {
        connectionError = null;
        changeConnectionState(Disconnected);

        try {
            if (client) {
                client.end();
                client = null;
            }
        } catch (error) {
        }
    });

    $('#subscribe').click(function() {
        var topic = $('#subscribe-topic')[0].value;
        if (subscriptionRows[topic]) {
            // Prevent duplicate subscriptions.
            return;
        }

        // Add a row with an unsubscribe button to the subscriptions table.
        var tr = $('<tr></tr>');
        var tdUnsub = $('<td class="unsub button">&#x274c;</td>');
        var tdTopic = $('<td class="topic"></td>');
        tdTopic.text(topic);
        tr.append(tdTopic);
        tr.append(tdUnsub);
        tdUnsub.click(function() {
            subscriptionRows[topic].remove();
            delete subscriptionRows[topic];
            client.unsubscribe(topic);
        });
        subscriptionRows[topic] = tr;
        $('#subscriptions tbody').append(tr);

        var qos = parseInt($("#subscribe-qos")[0].value);
        client.subscribe(topic, {qos: qos});
    });

    $('#clear-recent').click(function() {
        $('#recent-payloads tbody tr').remove();
        recentPayloadRows = {};
    });

    $('#clear-history').click(function() {
        $('#history tbody tr').remove();
    });

    $('#publish').click(function() {
        var topic = $('#publish-topic')[0].value;
        var payload = $('#publish-payload')[0].value;
        var retain = $('#publish-retained')[0].checked;
        var qos = parseInt($("#publish-qos")[0].value);
        client.publish(topic, payload, {qos: qos, retain: retain});
    });
});
