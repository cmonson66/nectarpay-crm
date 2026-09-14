<?php
/**
 * Shopper return handler. If the webhook has already created the order,
 * jump to the confirmation page; otherwise show a "waiting for confirmation"
 * page that polls the cart for its order id.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class NectarPayReturnModuleFrontController extends ModuleFrontController
{
    public $ssl = true;

    public function initContent()
    {
        parent::initContent();

        $id_cart  = (int) Tools::getValue('id_cart');
        $id_order = Order::getIdByCartId($id_cart);

        if ($id_order) {
            $order   = new Order((int) $id_order);
            $params  = [
                'id_cart'   => $id_cart,
                'id_module' => (int) $this->module->id,
                'id_order'  => (int) $id_order,
                'key'       => $order->secure_key,
            ];
            Tools::redirect('index.php?controller=order-confirmation&' . http_build_query($params));
        }

        $this->context->smarty->assign([
            'message' => $this->module->l('Waiting for on-chain confirmation. This page will refresh automatically.'),
        ]);

        $this->setTemplate('module:nectarpay/views/templates/front/return.tpl');
    }
}
