declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				email: string;
				name: string;
				role: string;
				department: string;
			};
		}
		interface PageData {}
		interface Platform {}
	}
}
export {};
