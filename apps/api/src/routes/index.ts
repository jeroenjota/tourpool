import { Router } from 'express';
import { toursRouter } from './tours.js';
import { poolsRouter } from './pools.js';
import { addressesRouter } from './addresses.js';
import { ridersRouter } from './riders.js';
import { countriesRouter } from './countries.js';
import { teamsRouter } from './teams.js';
import { tourTeamsRouter } from './tourTeams.js';
import { teamRidersRouter } from './teamRiders.js';
import { stagesRouter } from './stages.js';
import { stageResultsRouter } from './stageResults.js';
import { participantsRouter } from './participants.js';
import { participantRidersRouter } from './participantRiders.js';
import { participantPointsRouter } from './participantPoints.js';
import { optionsRouter } from './options.js';
import { standardPointsRouter } from './standardPoints.js';
import { pointAllocationsRouter } from './pointAllocations.js';
import { authenticate, requireAdmin } from '../auth.js';
import { poolRules, poolScope, requireStaff } from '../poolAccess.js';
import { authRouter } from './auth.js';
import { meRouter, publicRouter } from './me.js';
import { accountsRouter } from './accounts.js';
import { adminRouter } from './admin.js';
import { organisationsRouter } from './organisations.js';

export const apiRouter = Router();

apiRouter.get('/', (_request, response) => {
  response.json({
    name: 'tourpool-api',
    version: '0.1.0',
    resources: [
      'tours',
      'pools',
      'organisations',
      'addresses',
      'riders',
      'countries',
      'teams',
      'tour-teams',
      'team-riders',
      'stages',
      'stage-results',
      'participants',
      'participant-riders',
      'participant-points',
      'options',
      'standard-points',
      'point-allocations'
    ]
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/public', publicRouter);
apiRouter.use(authenticate);
apiRouter.use('/me', meRouter);
apiRouter.use(requireStaff);
apiRouter.use('/accounts', accountsRouter);
apiRouter.use('/pools', poolScope(poolRules.pools), poolsRouter);
apiRouter.use('/team-riders', poolScope(poolRules.readOnly), teamRidersRouter);
apiRouter.use('/stages', poolScope(poolRules.readOnly), stagesRouter);
apiRouter.use('/stage-results', poolScope(poolRules.stageResults), stageResultsRouter);
apiRouter.use('/participants', poolScope(poolRules.participants), participantsRouter);
apiRouter.use('/participant-riders', poolScope(poolRules.participantRiders), participantRidersRouter);
apiRouter.use('/participant-points', poolScope(poolRules.participantPoints), participantPointsRouter);
apiRouter.use('/options', poolScope(poolRules.options), optionsRouter);
apiRouter.use('/standard-points', poolScope(poolRules.readOnly), standardPointsRouter);
apiRouter.use('/point-allocations', poolScope(poolRules.pointAllocations), pointAllocationsRouter);
apiRouter.use(requireAdmin);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/organisations', organisationsRouter);
apiRouter.use('/tours', toursRouter);
apiRouter.use('/addresses', addressesRouter);
apiRouter.use('/riders', ridersRouter);
apiRouter.use('/countries', countriesRouter);
apiRouter.use('/teams', teamsRouter);
apiRouter.use('/tour-teams', tourTeamsRouter);