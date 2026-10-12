<script>
  import ResponseHistoryMenu from '../../../src/lib/components/ResponseHistoryMenu.svelte';
  import Button from '../../../src/lib/components/ui/Button.svelte';
  const entries=[{_id:'res_history_a',created:1720000000000,status:200},{_id:'res_history_b',created:1720000010000,status:404},{_id:'res_history_c',created:1720000020000,status:'Error Ω'}];
  let currentId=$state('res_history_b');
  let calls=$state(0);
</script>
<main style="padding: 24px; display: flex; justify-content: flex-end; gap: 12px">
  <ResponseHistoryMenu history={entries} {currentId} onselect={entry=>{currentId=entry._id;calls++;}} />
  <Button>Outside history</Button>
  <Button onclick={()=>{currentId='res_history_b';calls=0;}}>Reset history fixture</Button>
  <output aria-label="Selected response ID">{currentId}</output>
  <output aria-label="History selections">{calls}</output>
</main>
