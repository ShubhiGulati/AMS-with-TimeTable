const Paper = require("../../../models/reviewModule/paper.js");
const express = require("express");
const bodyParser = require("body-parser");
const User = require("../../../models/reviewModule/user.js");
const XUser = require("../../../models/usermanagement/user.js");
const Event = require("../../../models/reviewModule/event.js");
const { sendMail } = require("../../mailerModule/mailer.js"); // Importing the sendMail function
const getEnvironmentURL =require('../../../getEnvironmentURL.js')

const app = express();
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());

const findAllPapers = async (req, res) => {
  const papers = await Paper.find({});
  if (!papers) {
    return res.status(401).json("No Papers Found");
  } else {
    return res.status(200).send(papers);
  }
};

const findEventPaper = async (req, res) => {
  let eventId = req.params.id;
  const paper = await Paper.find({ eventId: eventId }).exec();

  if (!paper) {
    return res.status(401).json("Invalid paperId");
  } else {
    return res.status(200).send(paper);
  }
};

const findPaper = async (req, res) => {
  let id = req.params.id;
  const paper = await Paper.find({ paperId: id }).exec();

  if (!paper) {
    return res.status(401).json("Invalid paperId");
  } else {
    return res.status(200).send(paper);
  }
};

const findPaperByReviewer = async (req, res) => {
  let id = req.params.id;
  const paper = await Paper.find({ 'reviewers.userId': id }).exec();

  if (!paper) {
    return res.status(401).json("Invalid ReviewerId");
  } else {
    return res.status(200).send(paper);
  }
};

const updatePaper = async (req, res) => {
  let paperId = req.params.id;
  console.log(paperId);
  const updateFields = req.body.updateFields;

  const paper = await Paper.findById(paperId);
  console.log(paperId);
  const user = req.body.user; // Assuming that the user is logged in and the user object is available in the request object

  // const customParam = { paperId: paperId };
  // const updateObject = { $set: { [updatedField]: updatedFieldValue } };

  // try {
  //   const updatedPaper = await Paper.findOneAndUpdate(customParam, updateFields, { new: true });
  //   res.status(200).send("user updated", updatedPaper);
  // } catch (error) {
  //   res.status(500).send("Internal server error", error);
  // }

  try {
    if (user.role === "editor") {
      for (const field of Object.keys(updateFields)) {
        console.log(field);
        if (
          paper.schema.paths[field] &&
          paper.schema.paths[field].options.editorAccess
        ) {
          console.log("inside if");
          paper[field] = updateFields[field];
        } else {
          return res
            .status(403)
            .json({ message: "Editors are not allowed to modify this field" });
        }
      }
      const newPaper = await paper.save();
      return res.status(200).json({ message: "Paper updated", newPaper });
    } else if (user.role === "reviewer") {
      for (const field of Object.keys(updateFields)) {
        if (
          paper.schema.paths[field] &&
          paper.schema.paths[field].options.reviewerAccess
        ) {
          paper[field] = updateFields[field];
        } else {
          return res.status(403).json({
            message: "Reviewers are not allowed to modify this field",
          });
        }
      }
    } else if (user.role === "author") {
      for (const field of Object.keys(updateFields)) {
        if (
          paper.schema.paths[field] &&
          paper.schema.paths[field].options.authorAccess
        ) {
          paper[field] = updateFields[field];
        } else {
          return res.status(403).json({
            message: "Authors are not allowed to modify this field",
          });
        }
      }
    }
    const updatePaper = await paper.save();
    res.status(200).json({ message: "Paper updated", updatePaper });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const addReviewer = async (req, res) => {
  try {
    const paperId = req.params.id;
    const { email,baseUrl } = req.body;

    if (!email) {
      console.error('Email is required');
      return res.status(400).send('Email is required');
    }
    let reviewers = await XUser.findOne({ email });

    const paper = await Paper.findById(paperId);

    if (!paper) {
      console.error('Given paper not found:', paperId);
      return res.status(404).send('Paper not found');
    }

    // Check if reviewer is already assigned
    const isAlreadyReviewer = paper.reviewers.some(r => r.userId.equals(reviewers._id));
    if (isAlreadyReviewer) {
      return res.status(400).send('Reviewer already added to this paper');
    }
    // Add reviewer to the paper
    paper.reviewers.push({ userId: reviewers._id,username:email});
    const eventId=paper.eventId;
    const event = await Event.findById(eventId);
    await paper.save();
    console.log("added successfully");
    const reviewerInvitationTemplate=event.templates.paperAssignment;
    const signature=event.templates.signature;
    const viewLink = `${baseUrl}/prm/${eventId}/editor/papers`; // Use the base URL

    // Send the reviewer invitation email
    await sendMail(
      email,
      `You have been added as a reviewer to the paper with title: ${paper.title}`,
      ` ${reviewerInvitationTemplate} <br>
      Please click <a href="${viewLink}">here</a> to view the papers <br>
      ${signature}
      `

    );
    res.status(200).send('Reviewer added to the paper successfully');
  } catch (error) {
    console.error('Error adding reviewer:', error);
    res.status(500).send('Internal server error');
  }
};
const removeReviewer = async (req,res)=>{
  try {
    // Find the paper by paperId
    const paperid = req.params.id;
    const {userId} = req.body;
    console.log(paperid);
    const paper = await Paper.findById(paperid);
    console.log(paper);

    if (!paper) {
        throw new Error('Paper not found');
    }

    // Filter out the reviewer with the given userId
    paper.reviewers = paper.reviewers.filter(reviewer => String(reviewer.userId) !== userId);

    // Save the updated paper document
    await paper.save();
    console.log(`Reviewer with userId ${userId} removed successfully from paper ${paperid}`);
    res.status(200).send("REMOVED SUCCESSFULLY"); // or you can return some meaningful response
} catch (error) {
    console.error('Error removing reviewer:', error.message);
    res.status(500).send(error) // or handle the error appropriately
}
};


module.exports = { findAllPapers, addReviewer, findEventPaper, findPaper, updatePaper, removeReviewer, findPaperByReviewer };
