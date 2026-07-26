import { requestExpandedMode } from '@devvit/web/client';

const button = document.getElementById('play-btn');
if (button) {
  button.addEventListener('click', (event) => {
    requestExpandedMode(event, 'game');
  });
}
