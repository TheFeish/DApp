App = {
    web3Provider: null,
    contracts: {},
    account: '0x0',
    events: [],
    couriers: [],
    buyer: '0x0',
    seller: '0x0',

    init: function () {
        return App.initWeb3();
    },

    initWeb3: function () {
        if (typeof web3 !== 'undefined') {
            // If a web3 instance is already provided by Meta Mask.
            App.web3Provider = web3.currentProvider;
            web3 = new Web3(web3.currentProvider);
        } else {
            // Specify default instance if no web3 instance provided
            App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
            web3 = new Web3(App.web3Provider);
        }

        return App.initContract();
    },

    initContract: function () {
        $.getJSON("Ordering.json", function (ordering) {
            // Instantiate a new truffle contract from the artifact
            App.contracts.Ordering = TruffleContract(ordering);
            // Connect provider to interact with contract
            App.contracts.Ordering.setProvider(App.web3Provider);

            App.listenForEvents();

            return App.render();
        });
    },

    render: function () {
        var orderingInstance;

        var loader = $("#loader");
        var forms = $("#forms");
        var events = $("#events");
        var ntsh = $("#ntsh");

        var sendOrderForm = $("#sendOrderForm");
        var sendPriceForm = $("#sendPriceForm");
        var sendSafepayForm = $("#sendSafepayForm");
        var sendInvoiceForm = $("#sendInvoiceForm");
        var confirmDeliveryForm = $("#confirmDeliveryForm");

        loader.show();
        ntsh.hide();
        forms.hide();
        events.hide();

        sendOrderForm.hide();
        sendPriceForm.hide();
        sendSafepayForm.hide();
        sendInvoiceForm.hide();
        confirmDeliveryForm.hide();

        // Load account data
        web3.eth.getCoinbase(function (err, account) {
            if (err === null) {
                App.account = account;
                $("#accountAddress").html("Your Account: " + account);
            }
        });

        // Load contract data
        App.contracts.Ordering.deployed().then(function (instance) {
            orderingInstance = instance;
            return orderingInstance.buyer();
        }).then(function (result) {
            App.buyer = result;

            return orderingInstance.owner()
        }).then(function (result) {
            loader.hide();
            forms.show();
            App.seller = result;

            if (App.account == App.seller) {
                sendPriceForm.show();
                sendInvoiceForm.show();
                events.show();
            }
            else if (App.account == App.buyer) {
                sendOrderForm.show();
                sendSafepayForm.show();
                events.show();
            }
            else if (App.couriers.includes(App.account)) {
                confirmDeliveryForm.show();
                events.show();
            }
            else {
                ntsh.show();
            }

            var eventHtml = '<h1>Events</h1>';
            App.events.forEach(element => eventHtml += `<p>${element}</p>`);
            events.html(eventHtml);

        }).catch(function (error) {
            console.warn(error);
        });
    },

    sendOrder: function () {
        var quantity = $('#quantity').val();
        App.contracts.Ordering.deployed().then(function (instance) {
            return instance.sendOrder(quantity, { from: App.account });
        }).then(function (result) {

        }).catch(function (err) {
            console.error(err);
        });
    },

    sendPrice: function () {
        var orderId = $('#orderIdSendPrice').val();
        var unitPrice = $('#unitPrice').val();
        var shippingPrice = $('#shippingPrice').val();
        App.contracts.Ordering.deployed().then(function (instance) {
            return instance.sendPrice(orderId, unitPrice, shippingPrice, { from: App.account });
        }).then(function (result) {

        }).catch(function (err) {
            console.error(err);
        });
    },

    sendSafepay: function () {
        var orderId = $('#orderIdSendSafepay').val();
        var safepay;

        App.contracts.Ordering.deployed().then(function (instance) {
            return instance.getOrderPrice.call(orderId);
        }).then(async function (result) {
			var safepay = await result;
            App.contracts.Ordering.deployed().then(function (instance) {
                return instance.sendSafepay(orderId, { from: App.account, value: safepay });
            }).then(function (result) {

            }).catch(function (err) {
                console.error(err);
            });
        }).catch(function (err) {
            console.error(err);
        });
    },

    sendInvoice: function () {
        var orderId = $('#orderIdSendInvoice').val();
        var courier = $('#courier').val();
        var date = new Date($('#deliveryDate').val());
        var deliveryDate = date.getTime() / 1000;
        App.contracts.Ordering.deployed().then(function (instance) {
            return instance.sendInvoice(orderId, courier, deliveryDate, { from: App.account });
        }).then(function (result) {

        }).catch(function (err) {
            console.error(err);
        });
    },

    confirmDelivery: function () {
        var invoiceId = $('#invoiceIdConfirmDelivery').val();
        var date = new Date($('#date').val());
        date = date.getTime() / 1000;
        App.contracts.Ordering.deployed().then(function (instance) {
            return instance.confirmDelivery(invoiceId, date, { from: App.account });
        }).then(function (result) {

        }).catch(function (err) {
            console.error(err);
        });
    },

    listenForEvents: function () {
        App.contracts.Ordering.deployed().then(function (instance) {
            instance.orderSent({}, {
                fromBlock: 0,
                toBlock: 'latest'
            }).watch(function (error, event) {
                var buyer = event.args.buyer;
                var seller = event.args.seller;
                var orderId = event.args.orderId.toString();
                var quantity = event.args.quantity.toString();
                App.events.push(`Order no. ${orderId}: ${buyer} ordered ${quantity} items from ${seller}`);
                App.render();
            });

            instance.priceSent({}, {
                fromBlock: 0,
                toBlock: 'latest'
            }).watch(function (error, event) {
                var buyer = event.args.buyer;
                var seller = event.args.seller;
                var orderId = event.args.orderId.toString();
                var orderPrice = web3.fromWei(event.args.orderPrice.toString());
                var shippingPrice = web3.fromWei(event.args.shippingPrice.toString());
                App.events.push(`Order no. ${orderId}: ${seller} sent order price of ${orderPrice} ETH and shipping price of ${shippingPrice} ETH to ${seller}`);
                App.render();
            });

            instance.safepaySent({}, {
                fromBlock: 0,
                toBlock: 'latest'
            }).watch(function (error, event) {
                var buyer = event.args.buyer;
                var seller = event.args.seller;
                var orderId = event.args.orderId.toString();
                var value = web3.fromWei(event.args.value.toString());
                App.events.push(`Order no. ${orderId}: ${buyer} sent safepay of ${value} ETH to ${seller}`);
                App.render();
            });

            instance.invoiceSent({}, {
                fromBlock: 0,
                toBlock: 'latest'
            }).watch(function (error, event) {
                var buyer = event.args.buyer;
                var seller = event.args.seller;
                var invoiceId = event.args.invoiceId.toString();
                var orderId = event.args.orderId.toString();
                var courier = event.args.courier;
                var deliveryDate = new Date(event.args.deliveryDate.toString() * 1000);
                App.events.push(`Invoice no. ${invoiceId}: ${buyer} sent invoice to ${seller} for delivery of order no. ${orderId} by ${courier} with estimated delivery date of ${deliveryDate}`);
                App.couriers.push(courier);
                App.render();
            });

            instance.deliveryConfirmed({}, {
                fromBlock: 0,
                toBlock: 'latest'
            }).watch(function (error, event) {
                var buyer = event.args.buyer;
                var seller = event.args.seller;
                var invoiceId = event.args.invoiceId.toString();
                var orderId = event.args.orderId.toString();
                var courier = event.args.courier;
                var deliveryDateReal = new Date(event.args.deliveryDateReal.toString() * 1000);
                App.events.push(`Invoice no. ${invoiceId}: ${courier} confirmed delivery of order no. ${orderId} form ${seller} to ${buyer} on ${deliveryDateReal}`);
                App.couriers.splice(App.couriers.indexOf(courier), 1);
                App.render();
            });
        });
    }
};

$(function () {
    $(window).load(function () {
        App.init();
    });
});