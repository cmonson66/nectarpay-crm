<?php
/**
 * Receives signed webhooks from NectarPay and validates the order.
 *
 * Signature: header `X-TXCPay-Signature: t=<unix>,v1=<hex>` where v1 is
 * HMAC-SHA256("<t>.<rawBody>", store.webhook_secret).
 *
 * Events: invoice.paid | invoice.underpaid | invoice.confirmed
 * We create the PrestaShop order on `invoice.confirmed` (fully settled).
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class NectarPayWebhookModuleFrontController extends ModuleFrontController
{
    public $ssl = true;

    public function postProcess()
    {
        $raw       = file_get_contents('php://input');
        $sigHeader = isset($_SERVER['HTTP_X_TXCPAY_SIGNATURE']) ? $_SERVER['HTTP_X_TXCPAY_SIGNATURE'] : '';
        $secret    = Configuration::get(NectarPay::CONFIG_WEBHOOK_SECRET);

        if (!$secret || !$sigHeader || !$raw) {
            $this->respond(400, 'missing signature');
        }

        // Parse `t=<unix>,v1=<hex>`.
        $t = null; $v1 = null;
        foreach (explode(',', $sigHeader) as $part) {
            $kv = explode('=', trim($part), 2);
            if (count($kv) !== 2) continue;
            if ($kv[0] === 't')  $t  = $kv[1];
            if ($kv[0] === 'v1') $v1 = $kv[1];
        }
        if (!$t || !$v1) {
            $this->respond(400, 'malformed signature');
        }

        // Reject replays older than 5 minutes.
        if (abs(time() - (int) $t) > 300) {
            $this->respond(401, 'stale timestamp');
        }

        $expected = hash_hmac('sha256', $t . '.' . $raw, $secret);
        if (!hash_equals($expected, $v1)) {
            PrestaShopLogger::addLog('NectarPay: webhook signature mismatch', 3);
            $this->respond(401, 'invalid signature');
        }

        $event = json_decode($raw, true);
        if (!$event || empty($event['type']) || empty($event['data'])) {
            $this->respond(400, 'bad payload');
        }

        // Only settle the order on final confirmation.
        if ($event['type'] !== 'invoice.confirmed') {
            $this->respond(200, 'ignored');
        }

        $order_id = isset($event['data']['order_id']) ? (int) $event['data']['order_id'] : 0;
        $inv_id   = isset($event['data']['invoice_id']) ? (string) $event['data']['invoice_id'] : '';

        if (!$order_id) {
            $this->respond(400, 'missing order_id');
        }

        $cart = new Cart($order_id);
        if (!Validate::isLoadedObject($cart)) {
            $this->respond(404, 'cart not found');
        }

        // Idempotency — webhooks can be retried.
        if (Order::getIdByCartId($cart->id)) {
            $this->respond(200, 'already recorded');
        }

        $currency = new Currency((int) $cart->id_currency);
        $amount   = (float) $cart->getOrderTotal(true, Cart::BOTH);
        $secure   = md5((string) $cart->id . '-nectarpay');

        $this->module->validateOrder(
            (int) $cart->id,
            (int) Configuration::get('PS_OS_PAYMENT'),
            $amount,
            $this->module->displayName,
            'NectarPay invoice ' . $inv_id,
            ['transaction_id' => $inv_id],
            (int) $currency->id,
            false,
            $secure
        );

        $this->respond(200, 'ok');
    }

    private function respond($code, $msg)
    {
        http_response_code($code);
        header('Content-Type: text/plain');
        echo $msg;
        exit;
    }
}
