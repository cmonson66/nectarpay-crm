<?php
/**
 * Creates a NectarPay invoice for the current cart and redirects the
 * shopper to the hosted checkout. Order creation happens in the webhook
 * controller once payment is confirmed on-chain.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class NectarPayRedirectModuleFrontController extends ModuleFrontController
{
    public $ssl = true;

    public function postProcess()
    {
        $cart = $this->context->cart;
        if (!$cart->id || !$cart->id_customer || !$cart->id_address_delivery || !$cart->id_address_invoice) {
            Tools::redirect('index.php?controller=order&step=1');
        }

        $api_base   = rtrim(Configuration::get(NectarPay::CONFIG_API_BASE) ?: 'https://nectar-pay.com', '/');
        $api_key    = Configuration::get(NectarPay::CONFIG_API_KEY);
        $currency   = new Currency((int) $cart->id_currency);
        $total      = (float) $cart->getOrderTotal(true, Cart::BOTH);
        $return_url = $this->context->link->getModuleLink('nectarpay', 'return', ['id_cart' => $cart->id], true);

        // Match the NectarPay public API shape exactly:
        //   POST /api/public/v1/invoices  Bearer sk_live_...
        //   { amount, currency, order_id?, description?, redirect_url? }
        // The webhook URL is configured per-store in the NectarPay dashboard,
        // not per-invoice — do not send it here.
        $payload = [
            'amount'       => $total,
            'currency'     => $currency->iso_code,
            'order_id'     => (string) $cart->id,   // echoed back in webhooks as data.order_id
            'description'  => 'PrestaShop cart #' . (int) $cart->id,
            'redirect_url' => $return_url,
        ];

        $ch = curl_init($api_base . '/api/public/v1/invoices');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $api_key,
            ],
            CURLOPT_TIMEOUT        => 15,
        ]);
        $body   = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status >= 200 && $status < 300 && $body) {
            $data = json_decode($body, true);
            if (!empty($data['checkout_url']) && !empty($data['id'])) {
                // Persist the NectarPay invoice ID against the cart so the
                // webhook + return handlers (and the merchant, later) can
                // reconcile against the NectarPay admin panel.
                Db::getInstance()->insert(
                    'nectarpay_invoice',
                    [
                        'id_cart'    => (int) $cart->id,
                        'invoice_id' => pSQL($data['id']),
                        'amount'     => (float) $total,
                        'currency'   => pSQL($currency->iso_code),
                        'created_at' => date('Y-m-d H:i:s'),
                    ],
                    false,
                    true,
                    Db::REPLACE
                );

                Tools::redirect($data['checkout_url']);
            }
        }

        PrestaShopLogger::addLog('NectarPay: invoice create failed [' . $status . '] ' . $body, 3);
        $this->errors[] = $this->module->l('Could not start a crypto payment. Please try again or pick another method.');
        $this->redirectWithNotifications('index.php?controller=order&step=1');
    }
}
