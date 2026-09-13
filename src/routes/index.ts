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

export const apiRouter = Router();

apiRouter.get('/', (_request, response) => {
  response.json({
    name: 'tourpool-api',
    version: '0.1.0',
    resources: [
      'tours',
      'pools',
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

apiRouter.use('/tours', toursRouter);
apiRouter.use('/pools', poolsRouter);
apiRouter.use('/addresses', addressesRouter);
apiRouter.use('/riders', ridersRouter);
apiRouter.use('/countries', countriesRouter);
apiRouter.use('/teams', teamsRouter);
apiRouter.use('/tour-teams', tourTeamsRouter);
apiRouter.use('/team-riders', teamRidersRouter);
apiRouter.use('/stages', stagesRouter);
apiRouter.use('/stage-results', stageResultsRouter);
apiRouter.use('/participants', participantsRouter);
apiRouter.use('/participant-riders', participantRidersRouter);
apiRouter.use('/participant-points', participantPointsRouter);
apiRouter.use('/options', optionsRouter);
apiRouter.use('/standard-points', standardPointsRouter);
apiRouter.use('/point-allocations', pointAllocationsRouter);