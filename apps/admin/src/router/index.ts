import { createRouter, createWebHistory } from 'vue-router';
import { useActivePoolStore } from '../stores/activePool';
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
import StandardPointsView from '../views/StandardPointsView.vue';
import StandingsView from '../views/StandingsView.vue';
import PointAllocationsView from '../views/PointAllocationsView.vue';

const redirectToPoolPage = (page: string) => {
  const poolID = useActivePoolStore().activePoolID;
  return poolID ? `/pools/${poolID}/${page}` : '/pools';
};

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
      path: '/pools/:poolID(\\d+)/participants',
      name: 'participants',
      component: ParticipantsView,
      meta: { poolPage: true }
    },
    {
      path: '/participants',
      redirect: () => redirectToPoolPage('participants')
    },
    {
      path: '/pools/:poolID(\\d+)/standings',
      name: 'standings',
      component: StandingsView,
      meta: { poolPage: true }
    },
    {
      path: '/standings',
      redirect: () => redirectToPoolPage('standings')
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
      path: '/pools/:poolID(\\d+)/options',
      name: 'options',
      component: OptionsView,
      meta: { poolPage: true }
    },
    {
      path: '/options',
      redirect: () => redirectToPoolPage('options')
    },
    {
      path: '/standard-points',
      name: 'standard-points',
      component: StandardPointsView
    },
    {
      path: '/pools/:poolID(\\d+)/point-allocations',
      name: 'point-allocations',
      component: PointAllocationsView,
      meta: { poolPage: true }
    },
    {
      path: '/point-allocations',
      redirect: () => redirectToPoolPage('point-allocations')
    }
  ]
});

router.beforeEach(to => {
  const poolID = Number(to.params.poolID);
  if (to.meta.poolPage && Number.isInteger(poolID) && poolID > 0) {
    useActivePoolStore().setActivePool(poolID);
  }
});
