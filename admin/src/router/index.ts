import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import RidersView from '../views/RidersView.vue';
import TeamsView from '../views/TeamsView.vue';
import TeamRidersView from '../views/TeamRidersView.vue';
import StagesView from '../views/StagesView.vue';
import PoolsView from '../views/PoolsView.vue';
import ToursView from '../views/ToursView.vue';
import ParticipantsView from '../views/ParticipantsView.vue';
import AddressesView from '../views/AddressesView.vue';
import OptionsView from '../views/OptionsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView
    },
    {
      path: '/riders',
      name: 'riders',
      component: RidersView
    },
    {
      path: '/teams',
      name: 'teams',
      component: TeamsView
    },
    {
      path: '/team-riders',
      name: 'team-riders',
      component: TeamRidersView
    },
    {
      path: '/stages',
      name: 'stages',
      component: StagesView
    },
    {
      path: '/pools',
      name: 'pools',
      component: PoolsView
    },
    {
      path: '/participants',
      name: 'participants',
      component: ParticipantsView
    },
    {
      path: '/tours',
      name: 'tours',
      component: ToursView
    },
    {
      path: '/addresses',
      name: 'addresses',
      component: AddressesView
    },
    {
      path: '/options',
      name: 'options',
      component: OptionsView
    }
  ]
});
