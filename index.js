const core = require('@actions/core');
const github = require('@actions/github');
const {
    context
} = require('@actions/github/lib/utils');
const octokit = github.getOctokit(process.env.GITHUB_TOKEN)

//#region Inputs
const oneApprovalLabelName = core.getInput('one-approval-label-name');
const twoApprovalsLabelName = core.getInput('two-approvals-label-name');
const changesRequestedLabelName = core.getInput('changes-requested-label-name');

const labelNames = [oneApprovalLabelName, twoApprovalsLabelName, changesRequestedLabelName]
//#endregion

runAction()

async function runAction() {
    performChecks();
    console.log("Input checks completed.")
    const payload = context.payload;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pullRequestNumber = payload.pull_request.number;

    console.log("Fetching existing labels and reviews for processing.")
    const [reviews, currentLabels] = await Promise.all([
        getPullRequestReviews(owner, repo, pullRequestNumber),
        getPullRequestLabels(owner, repo, pullRequestNumber)
     ]);

    // only fetch labels that are not part of the review process
    const currentNonReviewLabels = currentLabels.map(l => l.name).filter(l => !labelNames.includes(l));
    const reviewLabels = getLabels(reviews);

    //eliminate possible duplicates
    const labels = Array.from(new Set(currentNonReviewLabels.concat(reviewLabels)));

    if (labels.length > 0) {
        console.log(`New PR labels: ${JSON.stringify(labels)}`)
        const result = await octokit.rest.issues.setLabels({
            owner: payload.repository.owner.login,
            repo: payload.repository.name,
            issue_number: payload.pull_request.number,
            labels
        });
    
        if(result.status !== 200){
            throw new Error(
                `Could not update the labels using GitHub's API. HTTP STATUS ${result.status}`
            )
        }
        console.log(`Successfully updated the labels.`)
    }
    
    console.log("Completed.")
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

    if(result.status !== 200){
        throw new Error(
            `Could not fetch PR labels using GitHub's API. HTTP STATUS ${result.status}`
        )
    }
    console.log(`Found ${result.data.length} existing labels.`)
    return result.data
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

    if(result.status !== 200){
        throw new Error(
            `Could not fetch PR reviews using GitHub's API. HTTP STATUS ${result.status}`
        )
    }
    console.log(`Found ${result.data.length} PR reviews.`)
    return result.data
}
//#endregion

//#region Helper Functions
/**
 * Perform additional checks on the inputs of the action
 */
 function performChecks(){
    if (labelNames.filter(l => l).length !== 3) {
        throw new Error(
            "You need to specify inputs for `one-approval-label-name`, `two-approvals-label-name`, and `changes-requested-label-name`"
        )
    }
    
    if (context.eventName !== "pull_request_review") {
        throw new Error(
            "Make sure this Action is being triggered by a `pull_request_review` event."
        )
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
        if (!dic.has(user) || new Date(dic.get(user).submitted_at >= new Date(review.submitted_at))) {
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
    const reviews = getLastUserReviews(reviewsArray.filter(r => ["APPROVED", "CHANGES_REQUESTED"].includes(r.state)));

    const approvedCount = reviews.filter(review => review.state === "APPROVED").length;
    const changesRequestedCount = reviews.filter(review => review.state === "CHANGES_REQUESTED").length;
    const labels = [];

    if (approvedCount === 1) {
        labels.push(oneApprovalLabelName);
    } else if (approvedCount === 2) {
        labels.push(twoApprovalsLabelName);
    }
    if (changesRequestedCount > 0) {
        labels.push(changesRequestedLabelName);
    }

    return labels;
}
//#endregion