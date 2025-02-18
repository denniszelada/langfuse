import { type NextApiRequest, type NextApiResponse } from "next";

import { createPrompt } from "@/src/features/prompts/server/actions/createPrompt";
import { getPromptsMeta } from "@/src/features/prompts/server/actions/getPromptsMeta";
import {
  CreatePromptSchema,
  GetPromptsMetaSchema,
} from "@/src/features/prompts/server/utils/validation";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { prisma } from "@langfuse/shared/src/db";
import { authorizePromptRequestOrThrow } from "../utils/authorizePromptRequest";
import { RateLimitService } from "@/src/features/public-api/server/RateLimitService";

const getPromptsHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  const authCheck = await authorizePromptRequestOrThrow(req);

  const rateLimitCheck = await RateLimitService.getInstance().rateLimitRequest(
    authCheck.scope,
    "prompts",
  );

  if (rateLimitCheck?.isRateLimited()) {
    return rateLimitCheck.sendRestResponseIfLimited(res);
  }

  const input = GetPromptsMetaSchema.parse(req.query);
  const promptsMetadata = await getPromptsMeta({
    ...input,
    projectId: authCheck.scope.projectId,
  });

  return res.status(200).json(promptsMetadata);
};

const postPromptsHandler = async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  const authCheck = await authorizePromptRequestOrThrow(req);

  const rateLimitCheck = await RateLimitService.getInstance().rateLimitRequest(
    authCheck.scope,
    "prompts",
  );

  if (rateLimitCheck?.isRateLimited()) {
    return rateLimitCheck.sendRestResponseIfLimited(res);
  }

  const input = CreatePromptSchema.parse(req.body);
  const createdPrompt = await createPrompt({
    ...input,
    config: input.config ?? {},
    projectId: authCheck.scope.projectId,
    createdBy: "API",
    prisma: prisma,
  });

  return res.status(201).json(createdPrompt);
};

export const promptsHandler = withMiddlewares({
  GET: getPromptsHandler,
  POST: postPromptsHandler,
});
