let client = null;
let recentPayloadRows = {};
let subscriptionRows = {};

const Disconnected = 0;
const Connecting = 1;
const Connected = 2;
let connectionState = -1;
let connectionError = null;

function changeConnectionState(state) {
    if (connectionState != state) {
        connectionState = state;

        const status = $('#connection-status');

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
    row.addClass('editing');
}

function stopEditing(row) {
    row.find('.display').show();
    row.find('.editor').hide();
    row.find('.retained input').prop('disabled', true);
    row.removeClass('editing');
}

function publishEdited(topic, row) {
    const payload = row.find('.edit-payload')[0].value;
    const retain = row.find('.retained input')[0].checked;
    const qos = parseInt(row.find('.qos input')[0].value);
    client.publish(topic, payload, {qos: qos, retain: retain});
    stopEditing(row);
}

function formatNumber(value, digits) {
    return value.toString().padStart(digits, '0');
}

function currentTimeString() {
    const time = new Date();
    return time.getFullYear().toString() + '-' +
        formatNumber(time.getMonth() + 1, 2) + '-' +
        formatNumber(time.getDate(), 2) + ' ' +
        formatNumber(time.getHours(), 2) + ':' +
        formatNumber(time.getMinutes(), 2) + ':' +
        formatNumber(time.getSeconds(), 2);
}

function republishHistory(msg) {
    client.publish(msg.topic, msg.payload, {qos: msg.qos, retain: msg.retain});
}

function messageReceived(topic, payload, msg) {
    let row = recentPayloadRows[topic];
    if (!row) {
        row = $('<tr class="topic"></tr>');
        const tdName = $('<td class="topic"></td>')
        const tdPayload = $('<td class="payload"><div class="display"><span class="content"></span><span class="start-edit button button-border">&#x270e;</span></div>' +
            '<div class="editor"><span title="Cancel" class="edit-cancel button button-border">&#x274c;</span><span title="Publish" class="edit-publish button button-border">&#x2b95;</span>' +
            '<div class="edit-payload-container"><input class="edit-payload"></div></td>');
        const tdQoS = $('<td class="qos"><div class="display"><span></span></div><div class="editor"><input class="qos" type="number" min="0" max="2"></div></td>');
        const tdRetained = $('<td class="retained"><input type="checkbox" disabled="true"></td>');
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
        const trHistory = $('<tr></tr>');
        const tdTime = $('<td class="time"></td>');
        const tdTopic = $('<td class="topic"></td>');
        const tdPayload = $('<td class="payload"><span class="history-payload"></span><span title="Republish" class="history-publish button button-border">&#x2b95;</span></td>');
        const tdQoS = $('<td class="qos"></td>');
        const tdRetained = $('<td class="retained"></td>');
        tdTime.text(currentTimeString());
        tdTopic.text(topic);
        tdPayload.find('.history-payload').text(payload);
        tdPayload.find('.history-publish').click(function() { republishHistory(msg); });
        tdQoS.text(msg.qos);
        if (msg.retain) {
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
        connectionError = null;
        $('#connect').prop('disabled', true);

        if (client) {
            client.end();
        }

        const host = $('#connect-host')[0].value;
        const port = parseInt($('#connect-port')[0].value);
        const protocol = $('#connect-tls')[0].checked ? 'wss' : 'ws';
        const url = `${protocol}://${host}:${port}`
        console.log('Connecting to', url);
        client = mqtt.connect(url, {
            username: $('#connect-username')[0].value,
            password: $('#connect-password')[0].value
        });

        changeConnectionState(Connecting);

        client.on('connect', function() {
            console.log('Connected');
            changeConnectionState(Connected);
        });

        client.on('error', function(error) {
            console.log('Error:', error.message);
            connectionError = error.message;
            changeConnectionState(Disconnected);

            // Don't keep trying to reconnect.
            if (client) {
                client.end();
                client = null;
            }
        });

        client.on('reconnect', function() {
            console.log('Reconnecting');
            changeConnectionState(Connecting);
        });

        client.on('close', function() {
            console.log('Connection closed');
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
        const topic = $('#subscribe-topic')[0].value;
        if (subscriptionRows[topic]) {
            // Prevent duplicate subscriptions.
            return;
        }

        // Add a row with an unsubscribe button to the subscriptions table.
        const tr = $('<tr></tr>');
        const tdUnsub = $('<td class="unsub button">&#x274c;</td>');
        const tdTopic = $('<td class="topic"></td>');
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

        const qos = parseInt($("#subscribe-qos")[0].value);
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
        const topic = $('#publish-topic')[0].value;
        const payload = $('#publish-payload')[0].value;
        const retain = $('#publish-retained')[0].checked;
        const qos = parseInt($("#publish-qos")[0].value);
        client.publish(topic, payload, {qos: qos, retain: retain});
    });
});
