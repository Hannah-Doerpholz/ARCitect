<script lang="ts" setup>

import ArcCommanderService from '../ArcCommanderService.ts';

import appProperties from '../AppProperties.ts';

const showLoginView = ()=>{
  window.ipc.invoke('DataHubService.authenticate');
}

window.ipc.on('DataHubService.authentificationData', async user_data=>{
  appProperties.user = user_data;
  // const r = await ArcCommanderService.run([
  //     {
  //       args: ['config','setgituser','-l','-n',user_data.username,'-e',user_data.email],
  //       title: `Init Git User`,
  //       silent: false
  //     },
  //     {
  //       args: ['remote','token','store','-t',user_data.token.access_token],
  //       title: `Store Git Token`,
  //       silent: false
  //     }
  //   ],
  //   false
  // );
});

</script>

<template>

  <q-item v-if='!appProperties.user' clickable v-ripple @click='showLoginView'>
    <q-item-section avatar>
      <q-icon color='grey-7' name="exit_to_app"></q-icon>
    </q-item-section>
    <q-item-section style="margin-left:-1.2em;">Login</q-item-section>
  </q-item>
  <q-item v-else clickable v-ripple>
    <q-item-section avatar>
      <q-icon color='grey-7' name="account_circle"></q-icon>
    </q-item-section>
    <q-item-section style="margin-left:-1.2em;">
      <q-item-label style="">{{appProperties.user.name}}</q-item-label>
      <q-item-label caption style="font-size:0.8em;">{{appProperties.user.email}}</q-item-label>
    </q-item-section>
  </q-item>

</template>

<style>

</style>
