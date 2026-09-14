<?php
/**
 * NectarPay for PrestaShop 8.x
 *
 * Non-custodial crypto payments (BTC, TEXITcoin, stablecoins).
 * Creates a NectarPay invoice via REST and redirects the shopper
 * to the hosted pay page. A signed webhook marks the order paid.
 *
 * @author    NectarPay
 * @copyright NectarPay
 * @license   MIT
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

use PrestaShop\PrestaShop\Core\Payment\PaymentOption;

class NectarPay extends PaymentModule
{
    const CONFIG_API_KEY        = 'NECTARPAY_API_KEY';
    const CONFIG_WEBHOOK_SECRET = 'NECTARPAY_WEBHOOK_SECRET';
    const CONFIG_API_BASE       = 'NECTARPAY_API_BASE';
    const CONFIG_STORE_ID       = 'NECTARPAY_STORE_ID';

    public function __construct()
    {
        $this->name          = 'nectarpay';
        $this->tab           = 'payments_gateways';
        $this->version       = '1.0.0';
        $this->author        = 'NectarPay';
        $this->need_instance = 0;
        $this->bootstrap     = true;
        $this->controllers   = ['redirect', 'webhook', 'return'];
        $this->currencies    = true;
        $this->currencies_mode = 'checkbox';

        $this->ps_versions_compliancy = ['min' => '1.7.6.0', 'max' => _PS_VERSION_];

        parent::__construct();

        $this->displayName            = $this->l('NectarPay');
        $this->description            = $this->l('Accept BTC, TEXITcoin and stablecoins. Non-custodial — funds settle straight to your wallet.');
        $this->confirmUninstall       = $this->l('Uninstall NectarPay?');
    }

    public function install()
    {
        Configuration::updateValue(self::CONFIG_API_BASE, 'https://nectar-pay.com');

        Db::getInstance()->execute(
            'CREATE TABLE IF NOT EXISTS `' . _DB_PREFIX_ . 'nectarpay_invoice` (
              `id_cart`    INT UNSIGNED NOT NULL,
              `invoice_id` VARCHAR(64) NOT NULL,
              `amount`     DECIMAL(20,8) NOT NULL,
              `currency`   VARCHAR(8) NOT NULL,
              `created_at` DATETIME NOT NULL,
              PRIMARY KEY (`id_cart`),
              KEY `invoice_id` (`invoice_id`)
            ) ENGINE=' . _MYSQL_ENGINE_ . ' DEFAULT CHARSET=utf8;'
        );

        return parent::install()
            && $this->registerHook('paymentOptions')
            && $this->registerHook('displayPaymentReturn');
    }

    public function uninstall()
    {
        Configuration::deleteByName(self::CONFIG_API_KEY);
        Configuration::deleteByName(self::CONFIG_WEBHOOK_SECRET);
        Configuration::deleteByName(self::CONFIG_API_BASE);
        Configuration::deleteByName(self::CONFIG_STORE_ID);

        // Keep the invoice-cart mapping on uninstall for auditing.
        return parent::uninstall();
    }


    /* --------------------------------------------------------------- Config UI */

    public function getContent()
    {
        $output = '';

        if (Tools::isSubmit('submit_nectarpay')) {
            Configuration::updateValue(self::CONFIG_API_KEY, trim(Tools::getValue('api_key')));
            Configuration::updateValue(self::CONFIG_WEBHOOK_SECRET, trim(Tools::getValue('webhook_secret')));
            Configuration::updateValue(self::CONFIG_API_BASE, rtrim(trim(Tools::getValue('api_base')), '/'));
            $output .= $this->displayConfirmation($this->l('Settings saved.'));
        }

        return $output . $this->renderForm();
    }

    private function renderForm()
    {
        // Store is derived from the API key server-side; the merchant only
        // needs to paste the key + webhook secret from the NectarPay dashboard.
        $fields_form = [
            'form' => [
                'legend' => ['title' => $this->l('NectarPay settings')],
                'input'  => [
                    ['type' => 'text', 'label' => $this->l('API key'),        'name' => 'api_key',        'size' => 60, 'required' => true, 'desc' => 'sk_live_… from Dashboard → API keys'],
                    ['type' => 'text', 'label' => $this->l('Webhook secret'), 'name' => 'webhook_secret', 'size' => 60, 'required' => true, 'desc' => 'Dashboard → Webhooks → Signing secret'],
                    ['type' => 'text', 'label' => $this->l('API base URL'),   'name' => 'api_base',       'size' => 60, 'desc' => 'https://nectar-pay.com'],
                ],
                'submit' => ['title' => $this->l('Save'), 'class' => 'btn btn-default pull-right'],
            ],
        ];

        $helper = new HelperForm();
        $helper->module                  = $this;
        $helper->name_controller         = $this->name;
        $helper->token                   = Tools::getAdminTokenLite('AdminModules');
        $helper->currentIndex            = AdminController::$currentIndex . '&configure=' . $this->name;
        $helper->submit_action           = 'submit_nectarpay';
        $helper->default_form_language   = (int) Configuration::get('PS_LANG_DEFAULT');
        $helper->fields_value = [
            'api_key'        => Configuration::get(self::CONFIG_API_KEY),
            'webhook_secret' => Configuration::get(self::CONFIG_WEBHOOK_SECRET),
            'api_base'       => Configuration::get(self::CONFIG_API_BASE) ?: 'https://nectar-pay.com',
        ];

        return $helper->generateForm([$fields_form]);
    }


    /* --------------------------------------------------------------- Checkout */

    public function hookPaymentOptions($params)
    {
        if (!$this->active || !$this->checkCurrency($params['cart'])) {
            return [];
        }

        if (!Configuration::get(self::CONFIG_API_KEY)) {
            return [];
        }


        $option = new PaymentOption();
        $option->setCallToActionText($this->l('Pay with crypto (BTC, TXC, stablecoins)'))
            ->setAction($this->context->link->getModuleLink($this->name, 'redirect', [], true))
            ->setAdditionalInformation($this->l('You will be redirected to a secure NectarPay payment page.'))
            ->setLogo(Media::getMediaPath(_PS_MODULE_DIR_ . $this->name . '/views/img/logo.png'));

        return [$option];
    }

    public function hookDisplayPaymentReturn($params)
    {
        if (!$this->active) {
            return '';
        }
        return $this->l('Thanks — we will confirm your order as soon as your crypto payment is detected on-chain.');
    }

    public function checkCurrency($cart)
    {
        $currency_order    = new Currency((int) $cart->id_currency);
        $currencies_module = $this->getCurrency((int) $cart->id_currency);
        if (!is_array($currencies_module)) {
            return false;
        }
        foreach ($currencies_module as $c) {
            if ($currency_order->id == $c['id_currency']) {
                return true;
            }
        }
        return false;
    }
}
