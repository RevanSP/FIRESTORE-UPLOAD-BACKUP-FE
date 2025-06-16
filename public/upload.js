const uploadButton = document.getElementById("uploadButton");
const serviceAccountInput = document.getElementById("serviceAccountInput");
const collectionInput = document.getElementById("collectionInput");
const serviceAccountStatus = document.getElementById("serviceAccountStatus");
const statusIcon = document.getElementById("statusIcon");
const statusMessage = document.getElementById("statusMessage");

let isServiceAccountValid = false;

const validateServiceAccountUrl =
  "http://localhost:8787/validate-service-account";
const uploadCollectionUrl = "http://localhost:8787/upload-collection";

function showStatusBadge(type, message) {
  serviceAccountStatus.classList.remove(
    "hidden",
    "alert-info",
    "alert-success",
    "alert-error"
  );

  switch (type) {
    case "loading":
      serviceAccountStatus.classList.add("alert-info");
      statusIcon.className = "bi bi-info-circle text-lg";
      break;
    case "success":
      serviceAccountStatus.classList.add("alert-success");
      statusIcon.className = "bi bi-check-circle text-lg";
      break;
    case "error":
      serviceAccountStatus.classList.add("alert-error");
      statusIcon.className = "bi bi-x-circle text-lg";
      break;
    default:
      serviceAccountStatus.classList.add("hidden");
      return;
  }

  statusMessage.textContent = message;
}

async function validateServiceAccount(file) {
  showStatusBadge("loading", "Validating service account ...");

  const formData = new FormData();
  formData.append("serviceAccount", file);

  try {
    const { success } = await fetch(validateServiceAccountUrl, {
      method: "POST",
      body: formData,
    }).then((res) => res.json());

    isServiceAccountValid = success;

    if (success) {
      showStatusBadge("success", "Service account is valid and ready to use");
      collectionInput.disabled = false;
    } else {
      showStatusBadge("error", "Invalid service account key");
      collectionInput.disabled = true;
    }

    updateUploadButtonState();
  } catch (error) {
    collectionInput.disabled = true;
    isServiceAccountValid = false;
    showStatusBadge("error", "Failed to validate service account");
    updateUploadButtonState();
  }
}

function updateUploadButtonState() {
  uploadButton.disabled = !(
    isServiceAccountValid && collectionInput.files.length > 0
  );
}

serviceAccountInput.addEventListener("change", () => {
  const file = serviceAccountInput.files[0];
  if (file?.name.endsWith(".json")) {
    validateServiceAccount(file);
  } else {
    isServiceAccountValid = false;
    uploadButton.disabled = true;
    if (file) {
      showStatusBadge("error", "Please select a valid JSON file");
    } else {
      showStatusBadge("hide");
    }
  }
});

collectionInput.addEventListener("change", updateUploadButtonState);

uploadButton.addEventListener("click", async () => {
  const files = collectionInput.files;
  if (!files.length) return;

  uploadButton.innerHTML =
    '<span class="loading loading-ring loading-xs"></span>';
  uploadButton.disabled = true;

  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("collections", file));

  try {
    const { success, errors, results, details } = await fetch(
      uploadCollectionUrl,
      {
        method: "POST",
        body: formData,
      }
    ).then((res) => res.json());

    if (success) {
      collectionInput.value = "";
      showButtonState("success", results, errors);
    } else {
      console.error("Failed to upload collections:", details);
      showButtonState("failure");
    }
  } catch (error) {
    console.error("Upload error:", error.message);
    showButtonState("failure");
  } finally {
    uploadButton.disabled = false;
  }
});

function showButtonState(type, results = [], errors = []) {
  const icon = type === "success" ? "check2-circle" : "x-circle";
  uploadButton.innerHTML = `<i class="bi bi-${icon}"></i>`;
  setTimeout(() => {
    uploadButton.innerHTML = '<i class="bi bi-cloud-upload"></i>';
    updateUploadButtonState();
  }, 3000);

  if (type === "success" && errors.length) {
    console.log(
      `Partial success. Some files had errors:\n${errors
        .map((e) => `${e.collection}: ${e.error}`)
        .join("\n")}`
    );
  }
}

const uploadForm = document.getElementById("uploadForm");
const submitButton = document.getElementById("submitButton");
const jsonFile = document.getElementById("jsonFile");

jsonFile.addEventListener("change", () => {
  submitButton.disabled = !jsonFile.files.length;
});

uploadForm.addEventListener("submit", (e) => {
  e.preventDefault();
  console.log("Backup form submitted");
});