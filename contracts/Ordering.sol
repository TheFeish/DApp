// SPDX-License-Identifier: GPL-3.0 
pragma solidity >=0.4.22 <0.9.0;

contract Ordering {

    struct Order {
        uint id;
        uint quantity;
        uint price;
        uint safepay;
        Shipment shipment;
        bool initialized;
    }

    struct Shipment {
        address payable  courier;
        uint price;
        uint safepay;
        uint deliveryDate;
        uint deliveryDateReal;
        bool initialized;
    }

    struct Invoice {
        uint id;
        uint orderId;
        bool initialized;
    }
    
    address payable public owner;
    address public buyer;

    uint public orderNumber;
    uint public invoiceNumber;

    mapping (uint => Order) orders;
    mapping (uint => Invoice) invoices;

    constructor (address buyerAddress) payable {
        owner = payable (msg.sender);
        buyer = buyerAddress;
    }

    function sendOrder(uint quantity) public payable {
        require(msg.sender == buyer);

        orders[orderNumber] = Order(orderNumber, quantity, 0, 0, Shipment(payable(address(0)), 0, 0, 0, 0, false), true);
		
		emit orderSent(buyer, owner, orderNumber, quantity);
		
        orderNumber++;
    }

    function sendPrice(uint orderId, uint unitPrice, uint shippingPrice) public payable {
        require(msg.sender == owner);
        require(orders[orderId].initialized);

        orders[orderId].price = unitPrice * orders[orderId].quantity;
        orders[orderId].shipment.price = shippingPrice;
        orders[orderId].shipment.initialized = true;
		
		emit priceSent(buyer, owner, orderId, orders[orderId].price, shippingPrice);
    }

    function sendSafepay(uint orderId) public payable {
        require(msg.sender == buyer);
        require(orders[orderId].initialized);
        require((orders[orderId].price + orders[orderId].shipment.price) == msg.value);

        orders[orderId].safepay = orders[orderId].price;
        orders[orderId].shipment.safepay = orders[orderId].shipment.price;
		
		emit safepaySent(buyer, owner, orderId, msg.value);
    }

    function sendInvoice(uint orderId, address payable courier, uint deliveryDate) public payable {
        require(msg.sender == owner);
        require(orders[orderId].initialized);

        orders[orderId].shipment.courier = courier;
        orders[orderId].shipment.deliveryDate = deliveryDate;

        invoices[invoiceNumber] = Invoice(invoiceNumber, orderId, true);
		
		emit invoiceSent(buyer, owner, invoiceNumber, orderId, courier, deliveryDate);
		
        invoiceNumber++;
    }

    function confirmDelivery(uint invoiceId, uint date) public payable {
        require(invoices[invoiceId].initialized);
        require(msg.sender == orders[invoices[invoiceId].orderId].shipment.courier);

        orders[invoices[invoiceId].orderId].shipment.deliveryDateReal = date;

        owner.transfer(orders[invoices[invoiceId].orderId].safepay);
        orders[invoices[invoiceId].orderId].shipment.courier.transfer(orders[invoices[invoiceId].orderId].shipment.safepay);
		
		emit deliveryConfirmed(buyer, owner, invoiceId, invoices[invoiceId].orderId, msg.sender, date, orders[invoices[invoiceId].orderId].safepay, orders[invoices[invoiceId].orderId].shipment.safepay);
    }
	
	function getOrderPrice(uint orderId) view public returns (uint price) {
		require(orders[orderId].initialized);
		require(orders[orderId].shipment.initialized);
		
		price = orders[orderId].price + orders[orderId].shipment.price;
	}

	event orderSent(address buyer, address seller, uint orderId, uint quantity);
	
	event priceSent(address buyer, address seller, uint orderId, uint orderPrice, uint shippingPrice);
	
	event safepaySent(address buyer, address seller, uint orderId, uint value);
	
	event invoiceSent(address buyer, address seller, uint invoiceId, uint orderId, address courier, uint deliveryDate);
	
	event deliveryConfirmed(address buyer, address seller, uint invoiceId, uint orderId, address courier, uint deliveryDateReal, uint safepay, uint safepayDelivery);
}