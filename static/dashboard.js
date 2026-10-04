// Dummy data for now — later this will come from your database via a fetch() call

// Incident trend chart (last 7 days)
const trendCtx = document.getElementById('trendChart');
new Chart(trendCtx, {
    type: 'line',
    data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
            label: 'Incidents Reported',
            data: [5, 8, 6, 12, 9, 14, 11],
            borderColor: '#2dd4bf',
            backgroundColor: 'rgba(45, 212, 191, 0.15)',
            tension: 0.3,
            fill: true
        }]
    },
    options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
    }
});

// Severity breakdown chart
const severityCtx = document.getElementById('severityChart');
new Chart(severityCtx, {
    type: 'doughnut',
    data: {
        labels: ['High', 'Medium', 'Low'],
        datasets: [{
            data: [3, 5, 4],
            backgroundColor: ['#dc2626', '#d97706', '#16a34a']
        }]
    },
    options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
    }
});