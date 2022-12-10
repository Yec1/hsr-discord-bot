export function msToHMS(ms) {
    let seconds = ms / 1000;
    const hours = parseInt( seconds / 3600 );
    seconds = seconds % 3600;
    const minutes = parseInt( seconds / 60 );
    seconds = seconds % 60;
    if(hours === 0) return (`${minutes}:${~~(seconds)}`); else return (`${hours}:${minutes}:${~~(seconds)}`); 
}