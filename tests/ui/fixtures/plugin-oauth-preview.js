import {
  createOAuthPreviewHistoryGuard,
  oauthSourceContext,
} from "../../../src/lib/oauth-model.js";
import { initialData, newRequest } from "../../../src/lib/model.js";
/** @type {any} */ (window).__pluginOAuthPreviewFixture = {
  createOAuthPreviewHistoryGuard,
  oauthSourceContext,
  initialData,
  newRequest,
};
