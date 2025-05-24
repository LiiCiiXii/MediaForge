class MediaForge {
    constructor() {
        this.files = new Map();
        this.converting = new Set();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showWelcomeMessage();
    }

    setupEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // Click to upload
        uploadArea.addEventListener('click', (e) => {
            if (e.target === uploadArea || e.target.closest('.upload-area')) {
                fileInput.click();
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            fileInput.value = ''; // Reset for same file selection
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!uploadArea.contains(e.relatedTarget)) {
                uploadArea.classList.remove('dragover');
            }
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
    }

    handleFiles(fileList) {
        if (!fileList || fileList.length === 0) return;

        const validFiles = Array.from(fileList).filter(file => {
            const isValid = this.isValidFile(file);
            if (!isValid) {
                this.showNotification(`${file.name} is not a supported file type`, 'error');
            }
            return isValid;
        });

        if (validFiles.length === 0) return;

        validFiles.forEach(file => {
            const fileData = this.createFileData(file);
            this.files.set(fileData.id, fileData);
            this.renderFile(fileData);
        });

        this.updateFileCount();
        this.showFilesSection();
        this.showNotification(`${validFiles.length} file(s) added successfully!`, 'success');
    }

    isValidFile(file) {
        const validTypes = [
            'video/', 'audio/', 'image/'
        ];
        return validTypes.some(type => file.type.startsWith(type));
    }

    createFileData(file) {
        const id = this.generateId();
        const category = this.getFileCategory(file.type);
        
        return {
            id,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            category,
            settings: this.getDefaultSettings(category)
        };
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getFileCategory(type) {
        if (type.startsWith('video/')) return 'video';
        if (type.startsWith('audio/')) return 'audio';
        if (type.startsWith('image/')) return 'image';
        return 'unknown';
    }

    getDefaultSettings(category) {
        const defaults = {
            video: { format: 'mp4', quality: 80, resolution: '1920x1080', fps: 30 },
            audio: { format: 'mp3', quality: 80, bitrate: 192 },
            image: { format: 'jpeg', quality: 90 }
        };
        return defaults[category] || defaults.image;
    }

    renderFile(fileData) {
        const fileElement = this.createFileElement(fileData);
        document.getElementById('filesList').appendChild(fileElement);

        // Create image preview if it's an image
        if (fileData.category === 'image') {
            this.createImagePreview(fileData);
        }
    }

    createFileElement(fileData) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.setAttribute('data-file-id', fileData.id);

        fileDiv.innerHTML = `
            <div class="file-preview ${fileData.category}">
                ${this.getFileIcon(fileData.category)}
            </div>
            <div class="file-info">
                <div class="file-name">${fileData.name}</div>
                <div class="file-details">${this.formatFileSize(fileData.size)} • ${fileData.type}</div>
                <div class="file-settings">
                    <div class="setting-group">
                        <span class="setting-label">Format:</span>
                        <select class="select format-select">
                            ${this.getFormatOptions(fileData.category)}
                        </select>
                    </div>
                    <div class="setting-group">
                        <span class="setting-label">Quality:</span>
                        <input type="range" class="slider quality-slider" min="10" max="100" value="${fileData.settings.quality}" step="10">
                        <span class="quality-display">${fileData.settings.quality}%</span>
                    </div>
                    ${fileData.category === 'video' ? this.getVideoSettings(fileData) : ''}
                </div>
                <div class="progress-container">
                    <div class="progress-text">
                        <span>Converting...</span>
                        <span class="progress-percentage">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-primary convert-btn">
                    <i class="fas fa-download"></i>
                    Convert
                </button>
                <button class="btn btn-danger remove-btn">
                    <i class="fas fa-trash"></i>
                    Remove
                </button>
            </div>
        `;

        this.setupFileEventListeners(fileDiv, fileData);
        return fileDiv;
    }

    getFileIcon(category) {
        const icons = {
            video: '<i class="fas fa-video"></i>',
            audio: '<i class="fas fa-music"></i>',
            image: '<i class="fas fa-image"></i>'
        };
        return icons[category] || '<i class="fas fa-file"></i>';
    }

    getFormatOptions(category) {
        const formats = {
            video: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
            audio: ['mp3', 'wav', 'flac', 'aac', 'ogg'],
            image: ['jpeg', 'png', 'webp', 'gif', 'bmp']
        };

        return (formats[category] || []).map(format => 
            `<option value="${format}">${format.toUpperCase()}</option>`
        ).join('');
    }

    getVideoSettings(fileData) {
        return `
            <div class="setting-group">
                <span class="setting-label">Resolution:</span>
                <select class="select resolution-select">
                    <option value="3840x2160">4K (3840x2160)</option>
                    <option value="1920x1080" selected>1080p (1920x1080)</option>
                    <option value="1280x720">720p (1280x720)</option>
                    <option value="854x480">480p (854x480)</option>
                </select>
            </div>
            <div class="setting-group">
                <span class="setting-label">FPS:</span>
                <select class="select fps-select">
                    <option value="60">60 FPS</option>
                    <option value="30" selected>30 FPS</option>
                    <option value="24">24 FPS</option>
                </select>
            </div>
        `;
    }

    setupFileEventListeners(fileElement, fileData) {
        // Format change
        const formatSelect = fileElement.querySelector('.format-select');
        formatSelect.value = fileData.settings.format;
        formatSelect.addEventListener('change', (e) => {
            fileData.settings.format = e.target.value;
        });

        // Quality change
        const qualitySlider = fileElement.querySelector('.quality-slider');
        const qualityDisplay = fileElement.querySelector('.quality-display');
        qualitySlider.addEventListener('input', (e) => {
            const value = e.target.value;
            fileData.settings.quality = parseInt(value);
            qualityDisplay.textContent = `${value}%`;
        });

        // Video settings
        if (fileData.category === 'video') {
            const resolutionSelect = fileElement.querySelector('.resolution-select');
            const fpsSelect = fileElement.querySelector('.fps-select');

            resolutionSelect.addEventListener('change', (e) => {
                fileData.settings.resolution = e.target.value;
            });

            fpsSelect.addEventListener('change', (e) => {
                fileData.settings.fps = parseInt(e.target.value);
            });
        }

        // Convert button
        const convertBtn = fileElement.querySelector('.convert-btn');
        convertBtn.addEventListener('click', () => {
            this.convertFile(fileData.id);
        });

        // Remove button
        const removeBtn = fileElement.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => {
            this.removeFile(fileData.id);
        });
    }

    createImagePreview(fileData) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileElement = document.querySelector(`[data-file-id="${fileData.id}"]`);
            if (fileElement) {
                const preview = fileElement.querySelector('.file-preview');
                preview.innerHTML = `<img src="${e.target.result}" alt="${fileData.name}">`;
            }
        };
        reader.readAsDataURL(fileData.file);
    }

    async convertFile(fileId) {
        const fileData = this.files.get(fileId);
        if (!fileData || this.converting.has(fileId)) return;

        this.converting.add(fileId);
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        const convertBtn = fileElement.querySelector('.convert-btn');
        const progressContainer = fileElement.querySelector('.progress-container');
        const progressFill = fileElement.querySelector('.progress-fill');
        const progressPercentage = fileElement.querySelector('.progress-percentage');

        // Update UI
        convertBtn.disabled = true;
        convertBtn.innerHTML = '<i class="fas fa-spinner spinning"></i> Converting';
        progressContainer.style.display = 'block';

        try {
            // Simulate conversion process
            for (let i = 0; i <= 100; i += 2) {
                await this.delay(50);
                progressFill.style.width = `${i}%`;
                progressPercentage.textContent = `${i}%`;
            }

            // Simulate download
            await this.delay(500);
            this.downloadFile(fileData);
            this.showNotification(`${fileData.name} converted successfully!`, 'success');

        } catch (error) {
            console.error('Conversion error:', error);
            this.showNotification('Conversion failed. Please try again.', 'error');
        } finally {
            // Reset UI
            this.converting.delete(fileId);
            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i class="fas fa-download"></i> Convert';
            
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
                progressPercentage.textContent = '0%';
            }, 1000);
        }
    }

    downloadFile(fileData) {
        const link = document.createElement('a');
        const fileName = `converted_${fileData.name.split('.')[0]}.${fileData.settings.format}`;
        
        link.href = URL.createObjectURL(fileData.file);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    removeFile(fileId) {
        const fileData = this.files.get(fileId);
        if (!fileData) return;

        // Cancel conversion if in progress
        this.converting.delete(fileId);

        // Remove from DOM
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileElement) {
            fileElement.style.transition = 'all 0.3s ease';
            fileElement.style.opacity = '0';
            fileElement.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                fileElement.remove();
                this.files.delete(fileId);
                this.updateFileCount();
                
                if (this.files.size === 0) {
                    this.hideFilesSection();
                }
            }, 300);
        }

        this.showNotification(`${fileData.name} removed`, 'info');
    }

    updateFileCount() {
        const countElement = document.getElementById('fileCount');
        if (countElement) {
            countElement.textContent = this.files.size;
        }
    }

    showFilesSection() {
        const section = document.getElementById('filesSection');
        section.style.display = 'block';
        setTimeout(() => {
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
        }, 10);
    }

    hideFilesSection() {
        const section = document.getElementById('filesSection');
        section.style.opacity = '0';
        section.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            section.style.display = 'none';
        }, 300);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle'
        };

        notification.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            ${message}
        `;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Hide notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, type === 'error' ? 5000 : 3000);
    }

    showWelcomeMessage() {
        setTimeout(() => {
            this.showNotification('Welcome to MediaForge! Drop your files to get started.', 'info');
        }, 1000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mediaForge = new MediaForge();
});

// Global error handling
window.addEventListener('error', (e) => {
    console.error('Error:', e.error);
    if (window.mediaForge) {
        window.mediaForge.showNotification('An error occurred. Please try again.', 'error');
    }
});