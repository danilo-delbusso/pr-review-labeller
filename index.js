const core = require("@actions/core");
const github = require("@actions/github");
const { context } = require("@actions/github/lib/utils");
const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

//#region Inputs
const oneApprovalLabelName = core.getInput("one-approval-label-name");
const twoApprovalsLabelName = core.getInput("two-approvals-label-name");
const changesRequestedLabelName = core.getInput("changes-requested-label-name");
const updatedPrLabelName = core.getInput("updated-pr-label-name");

const labelNames = [
  oneApprovalLabelName,
  twoApprovalsLabelName,
  changesRequestedLabelName,
  updatedPrLabelName,
];
//#endregion

runAction();

async function runAction() {
  performChecks();
  console.log("Input checks completed.");
  const payload = context.payload;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pullRequestNumber = payload.pull_request.number;
  const action = payload.action;
  const eventName = context.eventName;

  const [reviews, currentLabels] = await Promise.all([
    getPullRequestReviews(owner, repo, pullRequestNumber),
    getPullRequestLabels(owner, repo, pullRequestNumber),
  ]);

  // only fetch labels that are not part of the review process
  const currentNonReviewLabels = currentLabels
    .map((l) => l.name)
    .filter((l) => !labelNames.includes(l));
  let currentReviewLabels = currentLabels
    .map((l) => l.name)
    .filter((l) => labelNames.includes(l));
  let reviewLabels = getLabels(reviews);

  // add updated if there are new commits (and remove changes requested if it's present)
  if ((eventName === "pull_request" || eventName === "pull_request_target") && action === "synchronize") {
    reviewLabels.push(updatedPrLabelName);
    reviewLabels = reviewLabels.filter(
      (label) => label !== changesRequestedLabelName
    );
  }

  // if there is a new review which isn't a comment, remove updated label
  if (
    eventName === "pull_request_review" &&
    action === "submitted" &&
    !arraysAreEqual(currentReviewLabels, reviewLabels) &&
    currentReviewLabels.includes(updatedPrLabelName)
  ) {
    currentReviewLabels = currentReviewLabels.filter(
      (label) => label !== updatedPrLabelName
    );
  }

  //eliminate possible duplicates
  const labels = Array.from(
    new Set(currentNonReviewLabels.concat(reviewLabels))
  );

  if (labels.length > 0) {
    console.log(`New PR labels: ${JSON.stringify(labels)}`);
    const result = await octokit.rest.issues.setLabels({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.pull_request.number,
      labels,
    });

    if (result.status !== 200) {
      throw new Error(
        `Could not update the labels using GitHub's API. HTTP STATUS ${result.status}`
      );
    }
    console.log(`Successfully updated the labels.`);
  }

  console.log("Completed.");
}

//#region API calls
/**
 * Get a PR's labels
 * @param {string} owner the owner of the repository
 * @param {string} repo the name of the repository
 * @param {number} pullRequestNumber the number of the pull request
 * @returns {Object} request result as returned by the API.
 */
async function getPullRequestLabels(owner, repo, pullRequestNumber) {
  const result = await octokit.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: pullRequestNumber,
  });

  if (result.status !== 200) {
    throw new Error(
      `Could not fetch PR labels using GitHub's API. HTTP STATUS ${result.status}`
    );
  }
  console.log(`Found ${result.data.length} existing labels.`);
  return result.data;
}

/**
 * Get a PR's reviews
 * @param {string} owner the owner of the repository
 * @param {string} repo the name of the repository
 * @param {number} pullRequestNumber the number of the pull request
 * @returns {Object} request result as returned by the API.
 */
async function getPullRequestReviews(owner, repo, pullRequestNumber) {
  const result = await octokit.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: pullRequestNumber,
  });

  if (result.status !== 200) {
    throw new Error(
      `Could not fetch PR reviews using GitHub's API. HTTP STATUS ${result.status}`
    );
  }
  console.log(`Found ${result.data.length} PR reviews.`);
  return result.data;
}
//#endregion

//#region Helper Functions
/**
 * Perform additional checks on the inputs of the action
 */
function performChecks() {
  const eventName = context.eventName;
  const action = context.payload.action;

  if (labelNames.filter((l) => l).length !== 4) {
    throw new Error(
      "You need to specify inputs for `one-approval-label-name`, `two-approvals-label-name`, `changes-requested-label-name`, and `updated-pr-label-name`"
    );
  }

  if (
    context.eventName !== "pull_request_review" &&
    context.eventName !== "pull_request"
  ) {
    throw new Error(
      "Make sure this Action is being triggered by a `pull_request_review` or `pull_request` event. You can also use `pull_request_target` instead of `pull_request`."
    );
  }

  if (eventName === "pull_request_review" && action !== "submitted") {
    throw new Error(
      "`pull_request_review` events only supports `submitted` type. "
    );
  }

  if ((eventName === "pull_request" || eventName === "pull_request_target") && action !== "synchronize") {
    throw new Error("`pull_request`/`pull_request_target` events only supports `synchronize` type. ");
  }
}

/**
 * Get array containing only the latest review for each user
 * @param {Array} reviews array of review objects as returned by GitHub's API
 * @returns {Array} array containing only the latest review for each user
 */
function getLastUserReviews(reviews) {
  const dic = new Map();
  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];
    const user = review.user.login;
    if (
      !dic.has(user) ||
      new Date(dic.get(user).submitted_at >= new Date(review.submitted_at))
    ) {
      dic.set(user, review);
    }
  }

  return Array.from(dic.values());
}

/**
 * Get review related labels
 * @param {Array} reviewsArray array of review objects as returned by GitHub's API
 * @returns {Array} array of label names that can be shown in the PR
 */
function getLabels(reviewsArray) {
  const reviews = getLastUserReviews(
    reviewsArray.filter((r) =>
      ["APPROVED", "CHANGES_REQUESTED"].includes(r.state)
    )
  );

  const approvedCount = reviews.filter(
    (review) => review.state === "APPROVED"
  ).length;
  const changesRequestedCount = reviews.filter(
    (review) => review.state === "CHANGES_REQUESTED"
  ).length;
  const labels = [];

  if (approvedCount === 1) {
    labels.push(oneApprovalLabelName);
  } else if (approvedCount >= 2) {
    labels.push(twoApprovalsLabelName);
  }
  if (changesRequestedCount > 0) {
    labels.push(changesRequestedLabelName);
  }

  return labels;
}

/**
 * Compare two arrays. Returns true if the arrays contain the same items, in whichever order.
 * Taken from https://stackoverflow.com/a/43478439
 * @returns true if arrays contain the same items, in whichever other
 */
function arraysAreEqual(_arr1, _arr2) {
  if (
    !Array.isArray(_arr1) ||
    !Array.isArray(_arr2) ||
    _arr1.length !== _arr2.length
  ) {
    return false;
  }

  // .concat() to not mutate arguments
  const arr1 = _arr1.concat().sort();
  const arr2 = _arr2.concat().sort();

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }

  return true;
}

//#endregion
