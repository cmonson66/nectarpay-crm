{extends file='page.tpl'}

{block name='page_content'}
  <div class="card card-block">
    <h1 class="h1">{l s='Payment received — waiting for confirmation' d='Modules.Nectarpay.Shop'}</h1>
    <p class="text-muted">{$message}</p>
    <p><small>{l s='This page will refresh in 20 seconds…' d='Modules.Nectarpay.Shop'}</small></p>
  </div>
  <script>setTimeout(function(){ window.location.reload(); }, 20000);</script>
{/block}
