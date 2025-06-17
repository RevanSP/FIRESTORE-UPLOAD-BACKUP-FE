document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("jsonFile");
  const submitButton = document.getElementById("submitButton");
  const originalButtonText = submitButton.textContent;
  const searchInput = document.getElementById("searchInput");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const selectAllCheckboxFooter = document.getElementById(
    "selectAllCheckboxFooter"
  );
  const paginationContainer = document.getElementById("pagination");
  const collectionsList = document.getElementById("collectionsList");
  const downloadSelectedButton = document.getElementById(
    "downloadSelectedButton"
  );
  const bulkDownloadFormatSelect =
    document.getElementById("bulkDownloadFormat");

  const backupServiceAccountStatus = document.getElementById(
    "backupServiceAccountStatus"
  );
  const backupStatusIcon = document.getElementById("backupStatusIcon");
  const backupStatusMessage = document.getElementById("backupStatusMessage");

  let collectionsData = [];
  let currentPage = 1;
  const itemsPerPage = 4;
  let selectedCollections = new Set();
  let isServiceAccountValidBackup = false;
  let isValidationInProgress = false;

  const validateServiceAccountUrl =
    "http://127.0.0.1:8787/validate-service-account";
  const backupEndpoint = "http://127.0.0.1:8787/backup";

  function showBackupStatusBadge(type, message) {
    backupServiceAccountStatus.classList.remove(
      "hidden",
      "alert-info",
      "alert-success",
      "alert-error"
    );

    switch (type) {
      case "loading":
        backupServiceAccountStatus.classList.add("alert-info");
        backupStatusIcon.className = "bi bi-info-circle text-lg";
        break;
      case "success":
        backupServiceAccountStatus.classList.add("alert-success");
        backupStatusIcon.className = "bi bi-check-circle text-lg";
        break;
      case "error":
        backupServiceAccountStatus.classList.add("alert-error");
        backupStatusIcon.className = "bi bi-x-circle text-lg";
        break;
      case "hide":
        backupServiceAccountStatus.classList.add("hidden");
        return;
      default:
        backupServiceAccountStatus.classList.add("hidden");
        return;
    }
    backupStatusMessage.textContent = message;
  }

  async function validateServiceAccountForBackup(file) {
    isValidationInProgress = true;
    isServiceAccountValidBackup = false;
    toggleSubmitButton();

    showBackupStatusBadge(
      "loading",
      "Validating service account for backup ..."
    );

    const formData = new FormData();
    formData.append("serviceAccount", file);

    try {
      const response = await fetch(validateServiceAccountUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Validation result:", result);

      if (
        result.success === true ||
        (result.validation &&
          Object.values(result.validation).every((v) => v === true))
      ) {
        isServiceAccountValidBackup = true;
        showBackupStatusBadge(
          "success",
          "Service account is valid and ready to use"
        );
      } else {
        isServiceAccountValidBackup = false;
        let errorMessage = "Invalid service account key.";
        if (result.error) errorMessage += ` ${result.error}`;
        if (result.details) errorMessage += ` Details: ${result.details}`;
        if (result.message) errorMessage += ` ${result.message}`;
        showBackupStatusBadge("error", errorMessage);
      }
    } catch (error) {
      console.error("Validation error:", error);
      isServiceAccountValidBackup = false;
      showBackupStatusBadge("error", `Invalid service account key`);
    } finally {
      isValidationInProgress = false;
      toggleSubmitButton();
    }
  }

  function toggleSubmitButton() {
    const hasValidFile =
      fileInput.files.length > 0 && fileInput.files[0]?.name.endsWith(".json");
    const canSubmit =
      hasValidFile && !isValidationInProgress && isServiceAccountValidBackup;

    submitButton.disabled = !canSubmit;

    console.log("Button state:", {
      hasValidFile,
      isValidationInProgress,
      isServiceAccountValidBackup,
      canSubmit,
    });
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    isServiceAccountValidBackup = false;
    isValidationInProgress = false;

    if (file) {
      if (file.name.endsWith(".json")) {
        validateServiceAccountForBackup(file);
      } else {
        showBackupStatusBadge(
          "error",
          "Please select a valid JSON file for service account"
        );
        toggleSubmitButton();
      }
    } else {
      showBackupStatusBadge("hide");
      toggleSubmitButton();
    }
  });

  toggleSubmitButton();

 document
  .getElementById("uploadForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!isServiceAccountValidBackup || isValidationInProgress) {
      alert("Please wait for service account validation to complete.");
      return;
    }

    showBackupStatusBadge("hide");

    submitButton.innerHTML =
      '<span class="loading loading-bars loading-xs"></span>';
    submitButton.disabled = true;

    const formData = new FormData();
    formData.append("credentialsFile", fileInput.files[0]);

    try {
      const response = await fetch(backupEndpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      submitButton.innerHTML = originalButtonText;

      if (data.success) {
        collectionsData = data.collections.map((entry) => ({
          name: entry.collection,
          data: entry.documents,
        }));
        updateCollectionsList();
        updatePagination();
      } else {
        alert(
          "Error: " +
            data.message +
            (data.details ? ` Details: ${data.details}` : "")
        );
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred while processing the request.");
    } finally {
      submitButton.innerHTML = originalButtonText;
      toggleSubmitButton();
    }
  });

  function convertToCsv(data) {
    if (!data || data.length === 0) {
      return "";
    }

    const headers = new Set();
    data.forEach((item) => {
      Object.keys(item).forEach((key) => headers.add(key));
    });

    const headerArray = Array.from(headers);
    const csvRows = [];
    csvRows.push(headerArray.map((header) => `"${header}"`).join(","));

    data.forEach((item) => {
      const values = headerArray.map((header) => {
        const value = item[header];
        if (value === null || value === undefined) {
          return "";
        }
        let stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes('"')) {
          stringValue = `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(","));
    });

    return csvRows.join("\n");
  }

  function downloadCollection(collection, format) {
    let fileName = `${collection.name}_backup`;
    let fileContent;
    let fileType;

    switch (format) {
      case "json":
        fileContent = JSON.stringify(collection.data, null, 2);
        fileType = "application/json";
        fileName += ".json";
        break;
      case "csv":
        fileContent = convertToCsv(collection.data);
        fileType = "text/csv";
        fileName += ".csv";
        break;
      default:
        console.error("Unsupported download format:", format);
        return;
    }

    const blob = new Blob([fileContent], { type: fileType });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function updateCollectionsList(filteredData = collectionsData) {
    collectionsList.innerHTML = "";

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
      const dataNotFoundRow = document.createElement("tr");
      const dataNotFoundCell = document.createElement("td");
      dataNotFoundCell.setAttribute("colspan", "3");
      dataNotFoundCell.classList.add("text-center");
      dataNotFoundCell.textContent = "Data not found";
      dataNotFoundRow.appendChild(dataNotFoundCell);
      collectionsList.appendChild(dataNotFoundRow);
    } else {
      pageData.forEach((collection) => {
        const row = document.createElement("tr");
        const checkboxCell = document.createElement("td");
        checkboxCell.classList.add("truncate");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add("checkbox", "checkbox-xs", "rounded-none");
        checkbox.dataset.collectionName = collection.name;
        checkbox.checked = selectedCollections.has(collection.name);
        checkbox.addEventListener("change", function () {
          if (checkbox.checked) {
            selectedCollections.add(collection.name);
          } else {
            selectedCollections.delete(collection.name);
          }
          checkSelected();
        });
        checkboxCell.appendChild(checkbox);
        row.appendChild(checkboxCell);

        const collectionCell = document.createElement("td");
        collectionCell.classList.add("truncate");
        collectionCell.textContent = collection.name;
        row.appendChild(collectionCell);

        const actionCell = document.createElement("td");
        actionCell.classList.add("truncate", "flex", "gap-2");

        const downloadJsonButton = document.createElement("button");
        downloadJsonButton.classList.add(
          "btn",
          "bg-base-100",
          "btn-xs",
          "border-2",
          "border-black",
          "rounded-none"
        );
        downloadJsonButton.innerHTML = `<i class="bi bi-filetype-json"></i> JSON`;
        downloadJsonButton.title = "Download as JSON";
        downloadJsonButton.addEventListener("click", function () {
          downloadCollection(collection, "json");
        });
        actionCell.appendChild(downloadJsonButton);

        const downloadCsvButton = document.createElement("button");
        downloadCsvButton.classList.add(
          "btn",
          "bg-base-100",
          "btn-xs",
          "border-2",
          "border-black",
          "rounded-none"
        );
        downloadCsvButton.innerHTML = `<i class="bi bi-filetype-csv"></i> CSV`;
        downloadCsvButton.title = "Download as CSV";
        downloadCsvButton.addEventListener("click", function () {
          downloadCollection(collection, "csv");
        });
        actionCell.appendChild(downloadCsvButton);

        row.appendChild(actionCell);
        collectionsList.appendChild(row);
      });
    }
  }

  function updatePagination() {
    const totalPages = Math.ceil(collectionsData.length / itemsPerPage);

    const existingPageButtons =
      paginationContainer.querySelectorAll(".page-button");
    existingPageButtons.forEach((button) => button.remove());

    for (let i = 1; i <= totalPages; i++) {
      const pageButton = document.createElement("button");
      pageButton.classList.add(
        "join-item",
        "btn",
        "btn-xs",
        "rounded-none",
        "page-button"
      );
      pageButton.textContent = i;
      pageButton.dataset.page = i;

      if (i === currentPage) {
        pageButton.classList.add("btn-active");
      }

      pageButton.addEventListener("click", function () {
        currentPage = parseInt(pageButton.dataset.page);
        updateCollectionsList();
        updatePagination();
      });

      paginationContainer.insertBefore(
        pageButton,
        document.getElementById("nextButton")
      );
    }

    const prevButton = document.getElementById("prevButton");
    const nextButton = document.getElementById("nextButton");

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
  }

  const prevButton = document.getElementById("prevButton");
  const nextButton = document.getElementById("nextButton");

  prevButton.addEventListener("click", function () {
    if (currentPage > 1) {
      currentPage--;
      updateCollectionsList();
      updatePagination();
    }
  });

  nextButton.addEventListener("click", function () {
    const totalPages = Math.ceil(collectionsData.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      updateCollectionsList();
      updatePagination();
    }
  });

  searchInput.addEventListener("input", function () {
    currentPage = 1;

    const searchTerm = searchInput.value.toLowerCase();

    const filteredCollections = collectionsData.filter((collection) =>
      collection.name.toLowerCase().includes(searchTerm)
    );

    updateCollectionsList(filteredCollections);
    updatePagination();
  });

  function toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll(
      '#collectionsList input[type="checkbox"]'
    );
    checkboxes.forEach((checkbox) => {
      checkbox.checked = checked;
      const collectionName = checkbox.dataset.collectionName;
      if (checked) {
        selectedCollections.add(collectionName);
      } else {
        selectedCollections.delete(collectionName);
      }
    });
    checkSelected();
  }

  function checkSelected() {
    const isDisabled = selectedCollections.size < 2;
    downloadSelectedButton.disabled = isDisabled;
    bulkDownloadFormatSelect.disabled = isDisabled;
  }

  selectAllCheckbox.addEventListener("change", function () {
    const isChecked = selectAllCheckbox.checked;
    selectAllCheckboxFooter.checked = isChecked;
    toggleSelectAll(isChecked);
  });

  selectAllCheckboxFooter.addEventListener("change", function () {
    const isChecked = selectAllCheckboxFooter.checked;
    selectAllCheckbox.checked = isChecked;
    toggleSelectAll(isChecked);
  });

  downloadSelectedButton.addEventListener("click", async function () {
    const zip = new JSZip();
    const selectedFormat = bulkDownloadFormatSelect.value.toLowerCase();

    for (const collectionName of selectedCollections) {
      const collection = collectionsData.find(
        (item) => item.name === collectionName
      );
      if (collection) {
        let fileContent;
        let fileExtension;

        switch (selectedFormat) {
          case "json":
            fileContent = JSON.stringify(collection.data, null, 2);
            fileExtension = "json";
            break;
          case "csv":
            fileContent = convertToCsv(collection.data);
            fileExtension = "csv";
            break;
          default:
            console.warn(
              `Unsupported format for bulk download: ${selectedFormat}. Defaulting to JSON.`
            );
            fileContent = JSON.stringify(collection.data, null, 2);
            fileExtension = "json";
            break;
        }
        zip.file(`${collection.name}.${fileExtension}`, fileContent);
      }
    }

    zip.generateAsync({ type: "blob" }).then(function (content) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `selected_collections_${selectedFormat}.zip`;
      a.click();
    });
  });

  checkSelected();
});